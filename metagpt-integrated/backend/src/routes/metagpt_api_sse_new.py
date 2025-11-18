#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
优化后的MetaGPT API Routes with SSE Support
主要优化点：
1. 简化StreamCapture缓冲逻辑，降低max_buffer至256，减少延迟
2. 在关键阶段添加强制刷新(sys.stdout.flush())
3. 增强错误处理和日志记录
4. 确保角色初始化输出更及时
5. 改进SSE事件格式，兼容前端处理
参考了流式输出最佳实践[3,4](@ref)和错误处理机制[6](@ref)
"""



import json
import os
import uuid
import sys
import time
import queue
import threading
import logging
import httpx
from datetime import datetime
import asyncio
import re
from contextlib import suppress
from pathlib import Path
from functools import lru_cache
from typing import Dict, Any, Optional, Generator, List, Tuple
from dataclasses import dataclass
from flask import Blueprint, request, jsonify, current_app, Response
from flask_cors import cross_origin

# 配置日志
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
# 降低 MetaGPT 内部日志的输出级别，避免在前端看到大量调试信息
for noisy_logger in [
    "metagpt",
    "metagpt.actions",
    "metagpt.roles",
    "metagpt.provider",
]:
    logging.getLogger(noisy_logger).setLevel(logging.WARNING)
# 添加utils路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.content_filter import content_filter

# MetaGPT imports

from metagpt.context import Context
from metagpt.roles import (
    ProductManager,
    Architect,
    Engineer,
    ProjectManager,
    QaEngineer
)
from metagpt.roles.di.data_interpreter import DataInterpreter
from metagpt.team import Team
from metagpt.schema import Message
from metagpt.actions import UserRequirement
from metagpt.configs.llm_config import LLMConfig, LLMType
from metagpt.provider.ollama_api import OllamaLLM
from metagpt.config2 import config as metagpt_config
from src.routes.chat_history import save_session_to_history, get_session_from_history

metagpt_bp = Blueprint('metagpt', __name__)

# 全局存储项目状态
project_sessions: Dict[str, Dict[str, Any]] = {}
# 全局存储停止信号
stop_signals: Dict[str, bool] = {}


class ProcessingStopped(Exception):
    """Raised when a session receives an explicit stop request."""


async def _run_team_with_stop(company: Team, n_round: int, session_id: Optional[str]):
    """Run MetaGPT team with cooperative stop polling."""
    ensure_not_stopped(session_id)
    run_task = asyncio.create_task(company.run(n_round=n_round))

    try:
        while True:
            ensure_not_stopped(session_id)
            if run_task.done():
                return await run_task
            await asyncio.sleep(0.2)
    except ProcessingStopped:
        if not run_task.done():
            run_task.cancel()
            with suppress(asyncio.CancelledError):
                await run_task
        raise


def _generate_repo_with_stop(
    *,
    session_id: Optional[str],
    ctx: Context,
    idea: str,
    investment: float,
    n_round: int,
    code_review: bool,
    run_tests: bool,
    implement: bool,
    project_name: str,
    inc: bool,
    project_path: Optional[str],
    reqa_file: Optional[str],
    max_auto_summarize_code: int,
    recover_path: Optional[str],
    roles_lists: List[str],
) -> Context:
    """Minimal-stop-aware variant of generate_repo used by streaming thread."""

    ensure_not_stopped(session_id)

    metagpt_config.update_via_cli(project_path, project_name, inc, reqa_file, max_auto_summarize_code)

    team_roles = [role for role in roles_lists if role != "data_interpreter"]

    if not recover_path:
        company = Team(context=ctx)
        if "product_manager" in team_roles:
            company.hire([ProductManager()])
        if "architect" in team_roles:
            company.hire([Architect()])
        if "project_manager" in team_roles:
            company.hire([ProjectManager()])
        if (implement or code_review) and "engineer" in team_roles:
            company.hire([Engineer(n_borg=5, use_code_review=code_review)])
        if "qa_engineer" in team_roles:
            company.hire([QaEngineer()])
    else:
        stg_path = Path(recover_path)
        if not stg_path.exists() or not str(stg_path).endswith("team"):
            raise FileNotFoundError(f"{recover_path} not exists or not endswith `team`")
        company = Team.deserialize(stg_path=stg_path, context=ctx)
        idea = company.idea

    print("当前已选择角色列表\n", roles_lists)

    company.invest(investment)
    ensure_not_stopped(session_id)

    company.run_project(idea)
    ensure_not_stopped(session_id)

    async def _execute():
        await _run_team_with_stop(company, n_round, session_id)

    asyncio.run(_execute())

    return ctx.repo


def ensure_not_stopped(session_id: Optional[str]) -> None:
    if session_id and stop_signals.get(session_id):
        raise ProcessingStopped(f"Session {session_id} stopped by user")


def mark_stop_event(session_id: str, reason: str = '用户已请求停止', output_queue: Optional[queue.Queue] = None) -> None:
    """Mark a session as stopped and push a stop event into its queue once."""
    session = project_sessions.get(session_id)
    if session is not None:
        if session.get('stop_event_sent'):
            return
        session['stop_event_sent'] = True
        if output_queue is None:
            output_queue = session.get('output_queue')

    if output_queue is None:
        return

    try:
        output_queue.put_nowait(('stopped', reason))
    except queue.Full:
        try:
            output_queue.put(('stopped', reason))
        except queue.Full:
            logger.warning(f"Stop queue full for session {session_id}, unable to push stop event")


@dataclass
class LLMRuntimeConfig:
    base_url: Optional[str]
    api_key: Optional[str]
    model: str
    api_type: str
    ollama_path: str
    test_timeout: float
    chat_timeout: int
    ollama_options: Dict[str, Any]
    openai_temperature: float
    openai_max_tokens: int


def _parse_float(env_key: str, default: float) -> float:
    try:
        return float(os.environ.get(env_key, default))
    except (TypeError, ValueError):
        return default


def _parse_int(env_key: str, default: int) -> int:
    try:
        return int(os.environ.get(env_key, default))
    except (TypeError, ValueError):
        return default


@lru_cache(maxsize=8)
def _resolve_ollama_suffix(base_url: str, model: str, api_key: str) -> Optional[str]:
    """Reuse MetaGPT's Ollama provider to resolve the effective suffix."""
    try:
        if not base_url:
            return None

        # Ollama provider expects a non-empty key; fall back to placeholder if missing.
        key_for_cfg = api_key or os.environ.get('METAGPT_LLM_API_KEY') or os.environ.get('OPENAI_API_KEY') or 'sk-'
        cfg = LLMConfig(
            api_key=key_for_cfg,
            api_type=LLMType.OLLAMA,
            base_url=base_url,
            model=model
        )
        llm = OllamaLLM(cfg)
        suffix = getattr(llm, 'suffix_url', None)
        if suffix:
            return suffix if suffix.startswith('/') else f'/{suffix}'
    except Exception as exc:  # noqa: BLE001 - log and fall back to default suffix
        logger.warning(f"Ollama suffix detection failed: {exc}")
    return None


def load_llm_runtime_config() -> LLMRuntimeConfig:
    # 运行参数
    base_url_env = os.environ.get('OPENAI_BASE_URL') or os.environ.get('METAGPT_LLM_BASE_URL')
    base_url = base_url_env.rstrip('/') if base_url_env else None
    api_key = os.environ.get('OPENAI_API_KEY') or os.environ.get('METAGPT_LLM_API_KEY')
    model = os.environ.get('METAGPT_LLM_MODEL') or 'gpt-3.5-turbo'
    api_type = (os.environ.get('METAGPT_LLM_API_TYPE') or '').lower()
    suffix_env = os.environ.get('METAGPT_OLLAMA_SUFFIX')
    detected_suffix = None
    if api_type == 'ollama' and base_url:
        detected_suffix = _resolve_ollama_suffix(base_url, model, api_key or '')
    effective_suffix = suffix_env or detected_suffix or '/api/chat'
    ollama_path = effective_suffix if effective_suffix.startswith('/') else f'/{effective_suffix}'

    ollama_temperature = _parse_float('OLLAMA_TEMPERATURE', 0.3)
    ollama_num_predict = _parse_int('OLLAMA_NUM_PREDICT', 512)
    openai_temperature = _parse_float('OPENAI_TEMPERATURE', 0.0)
    openai_max_tokens = _parse_int('OPENAI_MAX_TOKENS', 256)

    test_timeout = _parse_float('LLM_TEST_TIMEOUT', 8.0)
    chat_timeout = _parse_int('CHAT_REPLY_TIMEOUT', 20)

    return LLMRuntimeConfig(
        base_url=base_url,
        api_key=api_key,
        model=model,
        api_type=api_type,
        ollama_path=ollama_path,
        test_timeout=test_timeout,
        chat_timeout=chat_timeout,
        ollama_options={'temperature': ollama_temperature, 'num_predict': ollama_num_predict},
        openai_temperature=openai_temperature,
        openai_max_tokens=openai_max_tokens
    )


def _heuristic_detect_intent(text: Optional[str]) -> str:
    """规则兜底：无法从模型获取意图时使用。"""
    if not text:
        return 'chat'

    raw_text = str(text)
    t = raw_text.strip().lower()

    # 1) 明显代码/技术痕迹（优先）
    if '```' in raw_text:
        return 'model'
    if re.search(r"\b(def|class|return|for|while|if|import|from|package|using)\b", t):
        return 'model'
    if re.search(r"\.(py|js|jsx|ts|tsx|ipynb|sql|csv|json|md|yaml|yml|go|java|rb|php)\b", t):
        return 'model'
    tech_keywords = [
        'python','java','javascript','typescript','ts','go','rust','c++','c#','php','ruby','swift','kotlin',
        'sql','mysql','postgres','sqlite','mongodb','redis',
        'csv','json','yaml','toml','protobuf',
        'pandas','numpy','matplotlib','sklearn','pytorch','tensorflow',
        'docker','k8s','kubernetes','compose','pip','pip3','npm','yarn','pnpm',
        'node','react','vue','vite','next','nuxt','tailwind',
        'flask','django','fastapi','spring','springboot','gin','express',
        'api','rest','grpc','websocket','sse','oauth','jwt','swagger'
    ]
    if any(k in t for k in tech_keywords):
        return 'model'

    # 2) 组合意图：动词 + 目标词（优先级高于“短句闲聊”）
    verbs = [
        '创建','生成','写','写个','写一个','做','做个','做一个','开发','实现','搭建','构建','制作','编写',
        'create','build','make','develop','implement','design','generate','code','write'
    ]
    nouns = [
        '项目','系统','应用','app','网站','小程序','脚本','程序','服务','接口','api','微服务','工具','插件','库','组件','报表','仪表盘','小游戏','游戏','2048','贪吃蛇','扫雷',
        'project','system','application','app','service','api','microservice','tool','plugin','library','component','report','dashboard','game','script','program'
    ]
    if any(v in raw_text for v in verbs) and any(n in raw_text for n in nouns):
        return 'model'
    if any(n in raw_text for n in ['游戏','小游戏','项目','代码','脚本','接口','api']):
        return 'model'

    # 3) 问候/寒暄或极短无技术痕迹句子 -> chat
    greetings = ['你好','您好','嗨','哈喽','hello','hi','hey','早上好','上午好','下午好','晚上好','在吗','谢谢','再见','拜拜']
    if any(g in raw_text for g in greetings):
        return 'chat'
    if len(raw_text.strip()) <= 12 and not any(ch in raw_text for ch in ['{','}','[',']','(',')','=',';','/','\\']):
        return 'chat'

    # 4) 其它默认 chat
    return 'chat'


def _llm_detect_intent(user_text: Optional[str], cfg: LLMRuntimeConfig, timeout_sec: Optional[int] = None) -> Optional[str]:
    """调用后端 LLM 进行意图分类，模型需返回 chat 或 model。"""
    if not user_text or not cfg.base_url:
        return None

    timeout = timeout_sec if timeout_sec is not None else cfg.chat_timeout
    system_prompt = (
        "你是一个意图分类器。请判断用户的输入是日常闲聊还是需要调用 MetaGPT 多智能体的任务。"
        "如果是闲聊，回复单词 chat；如果需要多智能体处理，回复单词 model。"
        "严格只回复 chat 或 model。"
    )
    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': str(user_text)}
    ]

    try:
        if cfg.api_type == 'ollama':
            options = dict(cfg.ollama_options)
            options['temperature'] = 0.0
            options['num_predict'] = min(options.get('num_predict', 64), 64)
            payload = {
                'model': cfg.model,
                'messages': messages,
                'stream': False,
                'options': options
            }
            headers = {'Content-Type': 'application/json'}
            with httpx.Client(base_url=cfg.base_url, timeout=timeout) as client:
                resp = client.post(cfg.ollama_path, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
            content = (
                data.get('message', {}).get('content')
                or (data.get('choices') or [{}])[0].get('message', {}).get('content')
                or data.get('response', '')
                or ''
            )
        else:
            if not cfg.api_key:
                return None
            headers = {
                'Authorization': f'Bearer {cfg.api_key}',
                'Content-Type': 'application/json'
            }
            payload = {
                'model': cfg.model,
                'messages': messages,
                'stream': False,
                'temperature': 0.0,
                'max_tokens': 16
            }
            with httpx.Client(base_url=cfg.base_url, timeout=timeout) as client:
                resp = client.post('/chat/completions', headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
            content = data.get('choices', [{}])[0].get('message', {}).get('content', '')

        if not content:
            return None
        match = re.search(r"\b(chat|model)\b", content.lower())
        if match:
            return match.group(1)
        return None
    except httpx.TimeoutException:
        logger.warning("Intent detection via LLM timed out")
        return None
    except Exception as exc:
        logger.warning(f"Intent detection via LLM failed: {exc}")
        return None


def detect_intent(text: Optional[str], cfg: Optional[LLMRuntimeConfig] = None, timeout_sec: Optional[int] = None) -> Tuple[str, str]:
    """优先调用 LLM 判定意图，失败时回退规则。返回 (intent, source)。"""
    cfg_local = cfg or load_llm_runtime_config()

    intent_from_llm = _llm_detect_intent(text, cfg_local, timeout_sec)
    if intent_from_llm in ('chat', 'model'):
        return intent_from_llm, '模型判定'

    intent_fallback = _heuristic_detect_intent(text)
    return intent_fallback, '规则兜底'


class StreamCapture:
    """优化后的输出捕获类：降低缓冲大小，简化代码块处理，增加强制刷新"""
    def __init__(self, output_queue, max_buffer=256, session_id: Optional[str] = None):  # 降低缓冲大小至256
        self.output_queue = output_queue
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
        self.buffer = ""
        self.lock = threading.Lock()
        self.max_buffer = max_buffer
        self.session_id = session_id

    def __enter__(self):
        sys.stdout = self
        sys.stderr = self
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            self.flush()
        finally:
            sys.stdout = self.original_stdout
            sys.stderr = self.original_stderr

    def _check_stop(self):
        ensure_not_stopped(self.session_id)

    def write(self, text):
        if text is None or text == "":
            return

        self._check_stop()

        # 先回显到原始stdout以便调试
        try:
            self.original_stdout.write(text)
            self.original_stdout.flush()
        except Exception:
            pass

        with self.lock:
            self._check_stop()
            self.buffer += text

            # 简化：按换行符或缓冲阈值立即发送
            if '\n' in self.buffer or len(self.buffer) >= self.max_buffer:
                # 找到最后一个换行符位置
                if '\n' in self.buffer:
                    parts = self.buffer.rsplit('\n', 1)
                    to_send = parts[0] + '\n'
                    self.buffer = parts[1] if len(parts) > 1 else ""
                else:
                    to_send = self.buffer
                    self.buffer = ""

                if to_send:
                    try:
                        self.output_queue.put(('stdout', to_send))
                    except queue.Full:
                        pass

            self._check_stop()

    def flush(self):
        """强制刷新所有缓冲数据"""
        self._check_stop()
        with self.lock:
            self._check_stop()
            if self.buffer:
                to_send = self.buffer
                self.buffer = ""
                try:
                    self.output_queue.put(('stdout', to_send))
                except queue.Full:
                    pass
        self._check_stop()
        try:
            self.original_stdout.flush()
        except Exception:
            pass

def run_metagpt_with_stream(idea, investment, n_round, code_review, run_tests, implement, project_name, inc, project_path, reqa_file, max_auto_summarize_code, recover_path, roles, output_queue, session_id):
    """在单独线程中运行MetaGPT并捕获输出（优化版本）"""
    try:
        ensure_not_stopped(session_id)

        start_msg = f"开始处理消息: {idea}"
        filtered_start_msg = content_filter.filter_content(start_msg)
        if filtered_start_msg.strip():
            output_queue.put(('stdout', filtered_start_msg))
            sys.stdout.flush()

        with StreamCapture(output_queue, session_id=session_id):
            ensure_not_stopped(session_id)
            try:
                output_queue.put(('stdout', '开始生成代码仓库...'))
                sys.stdout.flush()
                ensure_not_stopped(session_id)

                ctx = Context()
                ensure_not_stopped(session_id)
                repo = _generate_repo_with_stop(
                    session_id=session_id,
                    ctx=ctx,
                    idea=idea,
                    investment=investment,
                    n_round=n_round,
                    code_review=code_review,
                    run_tests=run_tests,
                    implement=implement,
                    project_name=project_name,
                    inc=inc,
                    project_path=project_path,
                    reqa_file=reqa_file,
                    max_auto_summarize_code=max_auto_summarize_code,
                    recover_path=recover_path,
                    roles_lists=roles,
                )
                ensure_not_stopped(session_id)

                output_queue.put(('stdout', '代码仓库生成成功'))
                sys.stdout.flush()

                if repo and hasattr(repo, 'workdir') and repo.workdir:
                    project_files = []
                    for root, _, files in os.walk(repo.workdir):
                        for file in files:
                            project_files.append(os.path.join(root, file))
                    output_queue.put(('final', {'files': project_files}))
                else:
                    output_queue.put(('final', {'files': []}))

            except ProcessingStopped:
                raise
            except Exception as e:
                error_msg = f"MetaGPT 运行异常: {str(e)}"
                output_queue.put(('stdout', error_msg))
                output_queue.put(('error', error_msg))
                sys.stdout.flush()
                return

    except ProcessingStopped:
        mark_stop_event(session_id, output_queue=output_queue)
        return

    except Exception as e:
        error_msg = f"MetaGPT运行错误: {str(e)}"
        logger.error(error_msg)
        output_queue.put(('stdout', error_msg))
        output_queue.put(('error', error_msg))
    finally:
        if session_id in stop_signals:
            del stop_signals[session_id]
        output_queue.put(('stdout', "任务结束"))
        output_queue.put(('done', None))


def run_data_interpreter_with_stream(requirement, files_info, output_queue, session_id, max_rounds=8):
    """在单独线程中运行数据解释器并捕获输出"""
    try:
        ensure_not_stopped(session_id)

        normalized_requirement = requirement or ''
        start_msg = f"开始执行数据解释任务: {normalized_requirement[:60]}" if normalized_requirement else "开始执行数据解释任务"
        filtered_msg = content_filter.filter_content(start_msg)
        if filtered_msg.strip():
            output_queue.put(('stdout', filtered_msg))
            sys.stdout.flush()

        with StreamCapture(output_queue, session_id=session_id):
            ensure_not_stopped(session_id)
            try:
                from metagpt.context import Context
                from metagpt.environment import Environment
                from metagpt.roles.di.data_interpreter import DataInterpreter

                ctx = Context()
                env = Environment(context=ctx)
                interpreter = DataInterpreter()
                env.add_roles([interpreter])
                ensure_not_stopped(session_id)

                if files_info and files_info.get('summary'):
                    prompt = (
                        "# 用户需求\n"
                        + normalized_requirement.strip()
                        + "\n\n# 附件文件摘要\n"
                        + files_info['summary'].strip()
                        + "\n\n请结合附件信息完成分析。"
                    )
                else:
                    prompt = normalized_requirement

                async def _run(max_iters: int):
                    rounds = 0
                    result = None
                    while rounds < max_iters:
                        ensure_not_stopped(session_id)
                        result = await interpreter.run(with_message=prompt if rounds == 0 else None)
                        if interpreter.rc.env and interpreter.rc.env.is_idle:
                            break
                        if interpreter.rc.todo is None:
                            break
                        rounds += 1
                    return result

                final_message = asyncio.run(_run(max_rounds))
                ensure_not_stopped(session_id)

                tasks_payload = []
                plan_payload = []
                if getattr(interpreter, 'planner', None) and getattr(interpreter.planner, 'plan', None):
                    finished_tasks = interpreter.planner.plan.get_finished_tasks()
                    for task in finished_tasks:
                        tasks_payload.append(
                            {
                                'task_id': task.task_id,
                                'instruction': task.instruction,
                                'code': task.code,
                                'result': task.result,
                                'is_success': task.is_success,
                                'is_finished': task.is_finished,
                            }
                        )
                    for task in interpreter.planner.plan.tasks:
                        plan_payload.append(
                            {
                                'task_id': task.task_id,
                                'instruction': task.instruction,
                                'is_finished': task.is_finished,
                                'is_success': task.is_success,
                                'dependent_task_ids': task.dependent_task_ids,
                            }
                        )

                def _format_task_summary() -> str:
                    sections = []
                    for idx, task in enumerate(tasks_payload, start=1):
                        block_parts = [f"### 任务 {idx}: {task['instruction'].strip() if task['instruction'] else '未命名任务'}"]
                        code_block = (task['code'] or '').strip()
                        if code_block:
                            block_parts.append("```python\n" + code_block + "\n```")
                        result_block = (task['result'] or '').strip()
                        if result_block:
                            block_parts.append("运行结果:\n" + result_block)
                        status_text = '成功' if task.get('is_success') else '失败'
                        block_parts.append(f"执行状态: {status_text}")
                        sections.append("\n\n".join(block_parts))
                    summary = "\n\n".join(sections).strip()
                    if summary:
                        return summary
                    if final_message and getattr(final_message, 'content', None):
                        return str(final_message.content).strip()
                    return "数据解释任务已完成。"

                final_text = _format_task_summary()
                files_payload = files_info.get('paths') if files_info else []

                output_queue.put(
                    (
                        'final',
                        {
                            'final_text': final_text,
                            'files': files_payload,
                            'tasks': tasks_payload,
                            'plan': plan_payload,
                        },
                    )
                )
            except ProcessingStopped:
                raise
            except Exception as inner_exc:
                error_msg = f"数据解释器执行异常: {inner_exc}"
                output_queue.put(('stdout', error_msg))
                output_queue.put(('error', error_msg))
                sys.stdout.flush()
                return

    except ProcessingStopped:
        mark_stop_event(session_id, output_queue=output_queue)
        return

    except Exception as exc:
        error_msg = f"数据解释器运行错误: {exc}"
        logger.error(error_msg)
        output_queue.put(('stdout', error_msg))
        output_queue.put(('error', error_msg))
    finally:
        if session_id in stop_signals:
            del stop_signals[session_id]
        output_queue.put(('stdout', "数据解释任务结束"))
        output_queue.put(('done', None))

@metagpt_bp.route('/api/metagpt/test-connection', methods=['GET','POST'])
@cross_origin()
def test_connection():
    """快速验证当前 LLM 配置是否可用：发起一个最小请求，并带 8 秒超时。"""
    try:
        cfg = load_llm_runtime_config()

        if not cfg.base_url:
            return jsonify({'success': False, 'error': 'missing base_url'}), 400

        if cfg.api_type == 'ollama':
            options = dict(cfg.ollama_options)
            options['num_predict'] = min(options.get('num_predict', 128), 128)
            payload = {
                'model': cfg.model,
                'messages': [
                    {'role': 'system', 'content': '返回：pong'},
                    {'role': 'user', 'content': 'ping'}
                ],
                'stream': False,
                'options': options
            }
            headers = {'Content-Type': 'application/json'}
            with httpx.Client(base_url=cfg.base_url, timeout=cfg.test_timeout) as client:
                resp = client.post(cfg.ollama_path, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
            sample = (
                data.get('message', {}).get('content')
                or (data.get('choices') or [{}])[0].get('message', {}).get('content')
                or data.get('response', '')
                or ''
            )
            return jsonify({'success': True, 'message': 'LLM connected', 'sample': sample})

        if not cfg.api_key:
            return jsonify({'success': False, 'error': 'missing api_key'}), 400

        with httpx.Client(base_url=cfg.base_url, timeout=cfg.test_timeout) as client:
            resp = client.post(
                '/chat/completions',
                headers={
                    'Authorization': f'Bearer {cfg.api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': cfg.model,
                    'messages': [
                        {'role': 'system', 'content': '返回：pong'},
                        {'role': 'user', 'content': 'ping'}
                    ],
                    'stream': False,
                    'temperature': cfg.openai_temperature,
                    'max_tokens': min(cfg.openai_max_tokens, 64)
                }
            )
            resp.raise_for_status()
            data = resp.json()
        sample = data.get('choices', [{}])[0].get('message', {}).get('content', '')
        return jsonify({'success': True, 'message': 'LLM connected', 'sample': sample})
    except asyncio.TimeoutError:
        return jsonify({'success': False, 'error': 'timeout'}), 504
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
@metagpt_bp.route('/api/metagpt/chat/stream', methods=['POST'])
@cross_origin()
def chat_with_agents_stream():
    """与代理聊天（SSE流式输出）"""
    try:
        data = request.get_json()
        message = data.get('message', '')
        session_id = data.get('session_id')
        selected_agents = data.get('agents', ['product_manager', 'architect', 'engineer'])
        di_only = (
            isinstance(selected_agents, list)
            and len(selected_agents) == 1
            and selected_agents[0] == 'data_interpreter'
        )
        code_review = data.get('code_review', True)
        run_tests = data.get('run_tests', False)
        implement = data.get('implement', True)
        files = data.get('files') or []  # 前端传来的文件列表（Jupyter 容器内路径）

        # 兼容：如果没填 message 但附带了文件，则使用默认提示
        if (not message or not str(message).strip()) and isinstance(files, list) and len(files) > 0:
            message = '请基于我上传的文件进行分析与总结'

        if not message or not str(message).strip():
            return jsonify({'error': 'Message is required'}), 400

        # generate_repo 不再需要 company 对象，因此移除相关初始化逻辑
        # 仅保留 session_id 的生成和消息记录
        if not session_id or session_id not in project_sessions:
            session_id = str(uuid.uuid4())
            project_sessions[session_id] = {
                'status': 'chat',
                'messages': [],
                'start_time': datetime.now().isoformat(),
                'project_name': 'Chat Session',
                'selected_agents': selected_agents
            }

        session = project_sessions[session_id]

        user_message = {
            'role': 'user',
            'content': message,
            'timestamp': datetime.now().isoformat()
        }
        session['messages'].append(user_message)
        def llm_chat_sync(user_text: str, timeout_sec: Optional[int] = None, cfg: Optional[LLMRuntimeConfig] = None) -> str:
            """使用直连 OpenAI 兼容接口进行闲聊（避免 MetaGPT 重依赖），带超时。"""
            cfg_local = cfg or load_llm_runtime_config()
            sys_prompt = '你是一个友好的中文助手，请用简洁专业的中文回答用户问题。'

            if not cfg_local.base_url:
                return "抱歉，未配置模型服务。"
            try:
                timeout = timeout_sec if timeout_sec is not None else cfg_local.chat_timeout
                if cfg_local.api_type == 'ollama':
                    options = dict(cfg_local.ollama_options)
                    payload = {
                        'model': cfg_local.model,
                        'messages': [
                            {'role': 'system', 'content': sys_prompt},
                            {'role': 'user', 'content': user_text}
                        ],
                        'stream': False,
                        'options': options
                    }
                    headers = {'Content-Type': 'application/json'}
                    with httpx.Client(base_url=cfg_local.base_url, timeout=timeout) as client:
                        resp = client.post(cfg_local.ollama_path, headers=headers, json=payload)
                        resp.raise_for_status()
                        data = resp.json()
                    content = (
                        data.get('message', {}).get('content')
                        or (data.get('choices') or [{}])[0].get('message', {}).get('content')
                        or data.get('response', '')
                    )
                    return content or '（空回复）'

                if not cfg_local.api_key:
                    return "抱歉，未配置模型服务。"

                with httpx.Client(base_url=cfg_local.base_url, timeout=timeout) as client:
                    resp = client.post(
                        '/chat/completions',
                        headers={
                            'Authorization': f'Bearer {cfg_local.api_key}',
                            'Content-Type': 'application/json'
                        },
                        json={
                            'model': cfg_local.model,
                            'messages': [
                                {'role': 'system', 'content': sys_prompt},
                                {'role': 'user', 'content': user_text}
                            ],
                            'stream': False,
                            'temperature': cfg_local.openai_temperature,
                            'max_tokens': cfg_local.openai_max_tokens
                        }
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    return data.get('choices', [{}])[0].get('message', {}).get('content', '') or '（空回复）'
            except httpx.TimeoutException:
                return "抱歉，当前回复超时，请稍后再试。"
            except Exception as e2:
                logger.error(f"httpx chat failed: {e2}")
                return "抱歉，我暂时无法回答该问题。"

        def llm_chat_stream(
            user_text: str,
            timeout_sec: Optional[int] = None,
            cfg: Optional[LLMRuntimeConfig] = None
        ) -> Generator[Dict[str, Any], None, None]:
            """使用直连 LLM 进行流式闲聊输出，保留 <think> 思维链并标记类型。"""
            cfg_local = cfg or load_llm_runtime_config()
            sys_prompt = '你是一个友好的中文助手，请用简洁专业的中文回答用户问题。'

            if not cfg_local.base_url:
                yield {'kind': 'answer', 'content': "抱歉，未配置模型服务。"}
                return

            timeout = timeout_sec if timeout_sec is not None else cfg_local.chat_timeout
            messages = [
                {'role': 'system', 'content': sys_prompt},
                {'role': 'user', 'content': user_text}
            ]

            think_open = re.compile(r'<\s*think\s*>', re.IGNORECASE)
            think_close = re.compile(r'</\s*think\s*>', re.IGNORECASE)
            answer_buffer = ""
            think_buffer = ""
            pending = ""
            state = 'answer'

            def flush_answer(force: bool = False) -> Generator[Dict[str, Any], None, None]:
                nonlocal answer_buffer
                if not answer_buffer:
                    return
                segment = answer_buffer
                answer_buffer = ""
                if force or segment.strip():
                    yield {'kind': 'answer', 'content': segment.replace('\r', '')}

            def flush_think(force: bool = False) -> Generator[Dict[str, Any], None, None]:
                nonlocal think_buffer
                if not think_buffer:
                    return
                segment = think_buffer
                think_buffer = ""
                if force or segment.strip():
                    yield {'kind': 'think', 'content': segment.replace('\r', '')}

            def iter_raw_chunks() -> Generator[str, None, None]:
                try:
                    if cfg_local.api_type == 'ollama':
                        options = dict(cfg_local.ollama_options)
                        options['temperature'] = 0.0
                        payload = {
                            'model': cfg_local.model,
                            'messages': messages,
                            'stream': True,
                            'options': options
                        }
                        headers = {'Content-Type': 'application/json'}
                        with httpx.Client(base_url=cfg_local.base_url, timeout=timeout) as client:
                            with client.stream('POST', cfg_local.ollama_path, headers=headers, json=payload) as resp:
                                resp.raise_for_status()
                                for line in resp.iter_lines():
                                    if not line:
                                        continue
                                    try:
                                        data = json.loads(line)
                                    except json.JSONDecodeError:
                                        continue
                                    text = (
                                        (data.get('message') or {}).get('content')
                                        or data.get('response')
                                        or ''
                                    )
                                    if text:
                                        yield text
                    else:
                        if not cfg_local.api_key:
                            yield "抱歉，未配置模型 API Key。"
                            return

                        headers = {
                            'Authorization': f"Bearer {cfg_local.api_key}",
                            'Content-Type': 'application/json'
                        }
                        payload = {
                            'model': cfg_local.model,
                            'messages': messages,
                            'stream': True,
                            'temperature': cfg_local.openai_temperature,
                            'max_tokens': cfg_local.openai_max_tokens
                        }
                        with httpx.Client(base_url=cfg_local.base_url, timeout=timeout) as client:
                            with client.stream('POST', '/chat/completions', headers=headers, json=payload) as resp:
                                resp.raise_for_status()
                                for line in resp.iter_lines():
                                    if not line:
                                        continue
                                    payload_line = line
                                    if payload_line.startswith('data:'):
                                        payload_line = payload_line[len('data:'):].strip()
                                    if payload_line in ('', '[DONE]', '[done]'):
                                        continue
                                    try:
                                        data = json.loads(payload_line)
                                    except json.JSONDecodeError:
                                        continue
                                    for choice in data.get('choices', []) or []:
                                        delta = choice.get('delta') or {}
                                        text = delta.get('content')
                                        if text:
                                            yield text
                except httpx.TimeoutException:
                    yield "抱歉，当前回复超时，请稍后再试。"
                except Exception as e_stream:
                    logger.error(f"httpx chat stream failed: {e_stream}")
                    yield "抱歉，我暂时无法流式回答，该服务可能暂时不可用。"

            think_active = False

            def emit_think_start():
                nonlocal think_active
                if not think_active:
                    think_active = True
                    yield {'kind': 'think_start'}

            def emit_think_end():
                nonlocal think_active
                if think_active:
                    think_active = False
                    yield {'kind': 'think_end'}

            for raw_chunk in iter_raw_chunks():
                if not raw_chunk:
                    continue
                pending += raw_chunk

                while pending:
                    if state == 'answer':
                        match_open = think_open.search(pending)
                        if match_open:
                            pre_text = pending[:match_open.start()]
                            if pre_text:
                                answer_buffer += pre_text
                                for item in flush_answer(force=True):
                                    yield item
                            pending = pending[match_open.end():]
                            state = 'think'
                            for item in emit_think_start():
                                yield item
                            continue

                        answer_buffer += pending
                        pending = ""
                        for item in flush_answer():
                            yield item
                        break

                    else:  # state == 'think'
                        match_close = think_close.search(pending)
                        if match_close:
                            think_text = pending[:match_close.start()]
                            if think_text:
                                think_buffer += think_text
                                for item in flush_think(force=True):
                                    yield item
                            pending = pending[match_close.end():]
                            state = 'answer'
                            for item in emit_think_end():
                                yield item
                            continue

                        think_buffer += pending
                        pending = ""
                        for item in flush_think():
                            yield item
                        break

            if state == 'think':
                for item in flush_think(force=True):
                    yield item
                for item in emit_think_end():
                    yield item

            for item in flush_answer(force=True):
                yield item

        def read_file_text_safely(file_path: str, max_bytes: int = 512 * 1024) -> str:
            try:
                # 仅允许读取项目根或 backend 根下的 workspace 子目录，避免越权
                backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))  # .../backend
                project_root = os.path.abspath(os.path.join(backend_root, '..'))  # 项目根

                candidates = []
                if os.path.isabs(file_path):
                    candidates.append(file_path)
                else:
                    # 常见相对路径形式：
                    # - "workspace/..."（相对于 backend 根）
                    # - "backend/workspace/..."（相对于项目根）
                    candidates.append(os.path.join(project_root, file_path))
                    candidates.append(os.path.join(backend_root, file_path))
                    if file_path.startswith('workspace' + os.sep) or file_path.startswith('workspace/'):
                        candidates.append(os.path.join(backend_root, file_path))

                abs_path = None
                for p in candidates:
                    p_norm = os.path.abspath(p)
                    if os.path.exists(p_norm):
                        abs_path = p_norm
                        break

                if not abs_path:
                    return f"[文件不存在: {file_path}]"

                # 针对常见文本/表格读取，二进制文件仅提示
                _, ext = os.path.splitext(abs_path)
                ext = ext.lower()
                if ext in ['.csv', '.txt', '.md', '.json', '.py', '.js', '.ts', '.html', '.css']:
                    with open(abs_path, 'r', encoding='utf-8', errors='ignore') as f:
                        data = f.read(max_bytes)
                        return data
                if ext in ['.xlsx', '.xls']:
                    try:
                        import pandas as pd
                        df = pd.read_excel(abs_path, nrows=50)
                        return df.to_csv(index=False)[:max_bytes]
                    except Exception as e:
                        return f"[读取Excel失败: {e}]"
                # 其它文件简要说明
                size = os.path.getsize(abs_path)
                return f"[二进制文件 {os.path.basename(abs_path)} 大小 {size} 字节]"
            except Exception as e:
                return f"[读取失败: {e}]"

        def build_files_summary(files_list: List[Dict[str, Any]]) -> Dict[str, Any]:
            summaries = []
            returned_files = []
            for f in files_list:
                path = (f.get('path') or '').strip()
                name = f.get('name') or os.path.basename(path)
                if not path:
                    continue
                text = read_file_text_safely(path)
                summaries.append(f"文件: {name}\n路径: {path}\n内容预览:\n{(text or '')[:2000]}")
                returned_files.append(path)
            joined = '\n\n'.join(summaries)
            return { 'summary': joined, 'paths': returned_files }

        def generate_stream():
            try:
                cfg = load_llm_runtime_config()
                output_queue = queue.Queue(maxsize=100)
                session = project_sessions.get(session_id)
                if session is not None:
                    session['output_queue'] = output_queue
                    session['stop_event_sent'] = False
                yield f"data: {json.dumps({'type': 'start', 'session_id': session_id})}\n\n"

                # 1) 意图判定（支持前端覆盖）
                client_intent = (data.get('intent') or 'auto').strip().lower()
                if client_intent in ('chat', 'model'):
                    intent = client_intent
                    intent_source = '用户指定'
                else:
                    intent, intent_source = detect_intent(message, cfg)

                intent_label = '闲聊' if intent == 'chat' else 'Agent 任务'
                yield f"data: {json.dumps({'type': 'output', 'content': f'意图判定：{intent_label}（{intent_source}）'}, ensure_ascii=False)}\n\n"

                if intent == 'chat':
                    yield f"data: {json.dumps({'type': 'output', 'content': '闲聊模式：AI 正在生成回复…'}, ensure_ascii=False)}\n\n"

                files_info = None
                if isinstance(files, list) and len(files) > 0 and not di_only:
                    files_info = build_files_summary(files)

                # 2) 闲聊：直接调用大模型回复并结束
                if intent == 'chat':
                    if files_info and files_info.get('summary'):
                        yield f"data: {json.dumps({'type': 'output', 'content': '已接收文件，准备基于文件内容回答'})}\n\n"
                    user_prompt = message
                    if files_info and files_info.get('summary'):
                        user_prompt = (
                            "以下是用户上传的文件摘要，请结合这些内容回答问题。\n"
                            + files_info['summary']
                            + "\n---\n用户问题："
                            + message
                        )

                    streamed_answer_chunks: List[str] = []
                    for event in llm_chat_stream(user_prompt, cfg=cfg):
                        kind = event.get('kind') if isinstance(event, dict) else 'answer'
                        content = event.get('content') if isinstance(event, dict) else str(event)

                        if kind == 'think_start':
                            yield f"data: {json.dumps({'type': 'chat_think_start'})}\n\n"
                            continue
                        if kind == 'think_end':
                            yield f"data: {json.dumps({'type': 'chat_think_end'})}\n\n"
                            continue

                        filtered_chunk = content_filter.filter_content(content) if content else ''
                        if not filtered_chunk.strip():
                            continue

                        if kind == 'think':
                            yield f"data: {json.dumps({'type': 'chat_think_delta', 'content': filtered_chunk})}\n\n"
                            continue

                        streamed_answer_chunks.append(filtered_chunk)
                        yield f"data: {json.dumps({'type': 'chat_delta', 'content': filtered_chunk})}\n\n"

                    if not streamed_answer_chunks:
                        fallback_text = content_filter.filter_content(llm_chat_sync(user_prompt, cfg=cfg))
                        fallback_text = fallback_text or '（空回复）'
                        streamed_answer_chunks = [fallback_text]
                        yield f"data: {json.dumps({'type': 'chat_delta', 'content': fallback_text})}\n\n"

                    reply_text = ''.join(streamed_answer_chunks).strip() or '（空回复）'
                    resp = {
                        'role': 'assistant',
                        'content': reply_text,
                        'timestamp': datetime.now().isoformat()
                    }
                    session['messages'].append(resp)
                    session['status'] = 'completed'
                    final_payload = {'type': 'final', 'response': resp}
                    if files_info and files_info.get('paths'):
                        final_payload['response'] = {**resp, 'files': files_info['paths']}
                    save_session_to_history(session_id, session)
                    yield f"data: {json.dumps(final_payload)}\n\n"
                    yield f"data: {json.dumps({'type': 'end'})}\n\n"
                    if session is not None:
                        session.pop('output_queue', None)
                        session.pop('stop_event_sent', None)
                    return

                # 3) 智能体或数据解释器模式
                is_di_pipeline = bool(di_only)
                if is_di_pipeline:
                    if files_info and files_info.get('summary'):
                        yield f"data: {json.dumps({'type': 'output', 'content': '已接收文件摘要，将注入数据解释器上下文'})}\n\n"
                    yield f"data: {json.dumps({'type': 'output', 'content': '进入数据解释器模式：AI 正在执行数据分析…'})}\n\n"
                    thread = threading.Thread(
                        target=run_data_interpreter_with_stream,
                        args=(
                            message,
                            files_info,
                            output_queue,
                            session_id,
                        ),
                    )
                else:
                    from metagpt.software_company import generate_repo

                    thread = threading.Thread(
                        target=run_metagpt_with_stream,
                        args=(
                            message,
                            data.get("investment", 3.0),
                            data.get("n_round", 5),
                            code_review,
                            run_tests,
                            implement,
                            data.get("project_name", f"project_{int(time.time())}"),
                            data.get("inc", False),
                            data.get("project_path", None),
                            data.get("reqa_file", None),
                            data.get("max_auto_summarize_code", 0),
                            data.get("recover_path", None),
                            selected_agents,
                            output_queue,
                            session_id,
                        ),
                    )
                thread.daemon = True
                thread.start()

                aggregated_outputs: List[str] = []

                debug_line_patterns = [
                    re.compile(r"^params\s*=", re.IGNORECASE),
                    re.compile(r"^raw\s*=", re.IGNORECASE),
                    re.compile(r"^当前已有角色列表"),
                    re.compile(r"^messages\s*=", re.IGNORECASE),
                ]

                ollama_inline_pattern = re.compile(r"\[ollama[^]]*error[^]]*\]", re.IGNORECASE)
                ollama_error_line_patterns = [
                    re.compile(r"❌?\s*\*\*?错误\*\*?[:：].*", re.IGNORECASE),
                    re.compile(r"错误[:：].*模型调用失败", re.IGNORECASE),
                    re.compile(r"ollama\s+(?:http|decode)\s+error[:：]?.*", re.IGNORECASE),
                ]
                ollama_payload_line_patterns = [
                    re.compile(r"^b?[`\"]?\{.*\"model\".*", re.IGNORECASE),
                    re.compile(r"^b?[`\"]?\[.*\"model\".*", re.IGNORECASE),
                    re.compile(r"^\s*\"?(?:task_id|dependent_task_ids|instruction|task_type|model|message|role|done)\"?\s*[:=]", re.IGNORECASE),
                ]
                ollama_binary_payload_patterns = [
                    re.compile(r"^b['\"]\{.*", re.IGNORECASE),
                    re.compile(r"^raw\s*=\s*b['\"]\{.*", re.IGNORECASE),
                    re.compile(r"^b['\"][^']*\\x[0-9a-f]{2}.*", re.IGNORECASE),
                ]
                ollama_placeholder_patterns = [
                    re.compile(r"模型调用失败（详细信息已隐藏）"),
                    re.compile(r"模型调用失败\(详细信息已隐藏\)"),
                ]

                inline_payload_inline_patterns = [
                    re.compile(r"\{[^{}]*\"(?:model|role|message|done|task_type)\"[^{}]*\}"),
                    re.compile(r"\[[^\[\]]*\"(?:model|role|message|done|task_type)\"[^\[\]]*\]"),
                ]
                inline_payload_tokens = ['"model"', '"role"', '"message"', '"done"', '"task_type"']

                def _decode_escape_sequences(text: str) -> str:
                    if not text:
                        return ''
                    decoded = text
                    decoded = decoded.replace('\r\n', '\n')
                    decoded = decoded.replace('\r', '\n')
                    decoded = decoded.replace('\\r\\n', '\n')
                    decoded = decoded.replace('\\n', '\n')
                    decoded = decoded.replace('\\t', '\t')

                    def _replace_unicode(match: re.Match) -> str:
                        try:
                            return chr(int(match.group(1), 16))
                        except Exception:
                            return match.group(0)

                    decoded = re.sub(r"\\u([0-9a-fA-F]{4})", _replace_unicode, decoded)
                    decoded = decoded.replace('\\\\', '\\')
                    return decoded

                def _strip_debug_tokens(line: str) -> str:
                    cleaned = line
                    cleaned = re.sub(r"raw\s*=\s*b['\"].*", '', cleaned)
                    cleaned = re.sub(r"params\s*=\s*['\"].*", '', cleaned)
                    cleaned = re.sub(r"messages\s*=\s*\[.*", '', cleaned)
                    cleaned = re.sub(r"\s{2,}", ' ', cleaned)
                    return cleaned.strip()

                ollama_suppression_active = False

                def sanitize_output_chunk(text: str) -> str:
                    nonlocal ollama_suppression_active
                    if not text:
                        return ''
                    decoded = _decode_escape_sequences(text)
                    if (
                        'Traceback (most recent call last):' in decoded
                        and 'ProcessingStopped' in decoded
                    ):
                        return ''
                    lines: List[str] = []
                    skipping_payload = False

                    def _strip_inline_payloads(value: str) -> str:
                        if not value:
                            return ''

                        cleaned_value = value
                        for pattern in inline_payload_inline_patterns:
                            cleaned_value = pattern.sub('（详细信息已隐藏）', cleaned_value)

                        if any(token in cleaned_value for token in inline_payload_tokens):
                            for symbol in ('{', '['):
                                idx = cleaned_value.find(symbol)
                                if idx != -1:
                                    cleaned_value = cleaned_value[:idx].rstrip()
                                    break

                        return cleaned_value.strip()

                    for raw_line in decoded.split('\n'):
                        stripped = raw_line.strip()

                        if not stripped:
                            if lines and lines[-1] != '':
                                lines.append('')
                            skipping_payload = False
                            ollama_suppression_active = False
                            continue

                        if any(pattern.match(stripped) for pattern in debug_line_patterns):
                            continue

                        lower = stripped.lower()
                        cleaned = _strip_debug_tokens(ollama_inline_pattern.sub('', stripped))

                        if 'ollama' in lower and ('error' in lower or '[ollama' in lower):
                            prefix = stripped[: lower.index('ollama')].rstrip()
                            prefix_cleaned = _strip_debug_tokens(ollama_inline_pattern.sub('', prefix))
                            if prefix_cleaned:
                                lines.append(prefix_cleaned)
                            skipping_payload = True
                            ollama_suppression_active = True
                            continue

                        if ollama_suppression_active:
                            if any(pattern.match(stripped) for pattern in ollama_binary_payload_patterns) or any(pattern.match(cleaned) for pattern in ollama_payload_line_patterns):
                                continue
                            if any(pattern.search(cleaned) for pattern in ollama_error_line_patterns) or any(pattern.search(cleaned) for pattern in ollama_placeholder_patterns):
                                # stay in suppression mode if repeated error text
                                continue
                            ollama_suppression_active = False

                        if any(pattern.search(cleaned) for pattern in ollama_placeholder_patterns):
                            skipping_payload = True
                            ollama_suppression_active = True
                            continue

                        if any(pattern.search(cleaned) for pattern in ollama_error_line_patterns):
                            skipping_payload = True
                            ollama_suppression_active = True
                            continue

                        if skipping_payload:
                            if any(pattern.match(stripped) for pattern in ollama_binary_payload_patterns) or any(pattern.match(cleaned) for pattern in ollama_payload_line_patterns):
                                continue
                            skipping_payload = False

                        if any(pattern.match(stripped) for pattern in ollama_binary_payload_patterns) or any(pattern.match(cleaned) for pattern in ollama_payload_line_patterns):
                            if 'model' in stripped.lower():
                                continue

                        cleaned = re.sub(r"\s{2,}", ' ', cleaned).strip()
                        if cleaned:
                            cleaned = _strip_inline_payloads(cleaned)
                            if cleaned:
                                lines.append(cleaned)

                    return '\n'.join(lines).strip()

                def remember_output(text: str) -> bool:
                    if not text:
                        return False
                    normalized = sanitize_output_chunk(text)
                    if not normalized:
                        return False
                    if aggregated_outputs:
                        last = aggregated_outputs[-1]
                        if last.strip() == normalized.strip():
                            return False
                    aggregated_outputs.append(normalized)
                    return True

                think_open_pattern = re.compile(r"<\s*think\s*>", re.IGNORECASE)
                think_close_pattern = re.compile(r"</\s*think\s*>", re.IGNORECASE)
                think_active_flag = False
                think_error_keywords = [
                    'ollama http error',
                    'ollama decode error',
                    'ollama http error detected',
                    '"model":',
                    '**错误**'
                ]

                def split_output_and_think_segments(text: str) -> List[Dict[str, str]]:
                    nonlocal think_active_flag
                    events: List[Dict[str, str]] = []
                    remaining = text

                    while remaining:
                        if think_active_flag:
                            match_close = think_close_pattern.search(remaining)
                            if match_close:
                                fragment = remaining[:match_close.start()]
                                if fragment:
                                    events.append({'type': 'chat_think_delta', 'content': fragment})
                                events.append({'type': 'chat_think_end'})
                                think_active_flag = False
                                remaining = remaining[match_close.end():]
                                continue

                            if remaining:
                                events.append({'type': 'chat_think_delta', 'content': remaining})
                            remaining = ''
                        else:
                            match_open = think_open_pattern.search(remaining)
                            if match_open:
                                before = remaining[:match_open.start()]
                                if before:
                                    events.append({'type': 'output', 'content': before})
                                events.append({'type': 'chat_think_start'})
                                think_active_flag = True
                                remaining = remaining[match_open.end():]
                                continue

                            if remaining:
                                events.append({'type': 'output', 'content': remaining})
                            remaining = ''

                    return events

                while True:
                    try:
                        event_type, content = output_queue.get(timeout=10)  # 减少超时时间至10秒
                        if event_type == 'done':
                            break
                        elif event_type == 'stopped':
                            yield f"data: {json.dumps({'type': 'stopped', 'content': '处理已停止'})}\n\n"
                            break
                        elif event_type == 'stdout':
                            cleaned_output = sanitize_output_chunk(content)
                            if not cleaned_output:
                                continue

                            segments = split_output_and_think_segments(cleaned_output)
                            for segment in segments:
                                segment_type = segment.get('type')
                                segment_content = segment.get('content', '') if segment else ''

                                if segment_type == 'output':
                                    if not segment_content or not segment_content.strip():
                                        continue
                                    display_content = segment_content
                                    if not remember_output(segment_content):
                                        continue
                                    yield f"data: {json.dumps({'type': 'output', 'content': display_content}, ensure_ascii=False)}\n\n"
                                elif segment_type == 'chat_think_start':
                                    yield f"data: {json.dumps({'type': 'chat_think_start'})}\n\n"
                                elif segment_type == 'chat_think_delta':
                                    if not segment_content or not segment_content.strip():
                                        continue
                                    lower_segment = segment_content.lower()
                                    if any(keyword in lower_segment for keyword in think_error_keywords):
                                        if not remember_output(segment_content):
                                            continue
                                        yield f"data: {json.dumps({'type': 'output', 'content': segment_content}, ensure_ascii=False)}\n\n"
                                        continue
                                    yield f"data: {json.dumps({'type': 'chat_think_delta', 'content': segment_content}, ensure_ascii=False)}\n\n"
                                elif segment_type == 'chat_think_end':
                                    yield f"data: {json.dumps({'type': 'chat_think_end'})}\n\n"
                        elif event_type == 'error':
                            yield f"data: {json.dumps({'type': 'error', 'content': content})}\n\n"
                        elif event_type == 'final':
                            files_list: List[str] = []
                            final_text_override: Optional[str] = None
                            di_tasks: List[Dict[str, Any]] = []
                            di_plan: List[Dict[str, Any]] = []
                            if isinstance(content, dict):
                                files_payload = content.get('files')
                                if isinstance(files_payload, list):
                                    files_list = files_payload
                                final_text_override = content.get('final_text')
                                if is_di_pipeline:
                                    tasks_payload = content.get('tasks') or []
                                    if isinstance(tasks_payload, list):
                                        di_tasks = tasks_payload
                                    plan_payload = content.get('plan') or []
                                    if isinstance(plan_payload, list):
                                        di_plan = plan_payload

                            snapshot = [chunk for chunk in aggregated_outputs if isinstance(chunk, str)]
                            text_blocks: List[str] = []
                            for chunk in snapshot:
                                normalized_chunk = chunk.replace('\r\n', '\n').replace('\r', '\n')
                                stripped_chunk = normalized_chunk.strip()
                                if stripped_chunk:
                                    text_blocks.append(stripped_chunk)

                            summary_override = ''
                            if isinstance(final_text_override, str) and final_text_override.strip():
                                ollama_suppression_active = False
                                summary_override_raw = content_filter.filter_content(_decode_escape_sequences(final_text_override))
                                sanitized_override = sanitize_output_chunk(summary_override_raw)
                                summary_override = sanitized_override or summary_override_raw.strip()
                                ollama_suppression_active = False

                            combined_logs = '\n\n'.join(text_blocks).strip()
                            if summary_override:
                                final_text = summary_override
                            elif combined_logs:
                                final_text = combined_logs
                            else:
                                final_text = '数据解释任务已完成。' if is_di_pipeline else '多智能体任务已完成，但没有可展示的详细输出。'

                            final_message: Dict[str, Any] = {
                                'role': 'multi_agent',
                                'team_type': 'data_interpreter' if is_di_pipeline else 'multi_agent',
                                'content': final_text,
                                'timestamp': datetime.now().isoformat(),
                                'agents': selected_agents,
                            }
                            if files_list:
                                final_message['files'] = files_list
                            if snapshot:
                                final_message['status_lines'] = snapshot
                            if is_di_pipeline:
                                if di_tasks:
                                    final_message['tasks'] = di_tasks
                                if di_plan:
                                    final_message['plan'] = di_plan

                            session['messages'].append(final_message)
                            session['status'] = 'completed'
                            save_session_to_history(session_id, session)

                            final_payload = {
                                'type': 'final',
                                'response': final_message
                            }
                            yield f"data: {json.dumps(final_payload, ensure_ascii=False)}\n\n"
                            aggregated_outputs.clear()
                    except queue.Empty:
                        yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                        continue

                yield f"data: {json.dumps({'type': 'end'})}\n\n"
            except Exception as e:
                error_msg = f"流生成错误: {str(e)}"
                logger.error(error_msg)
                yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"
            finally:
                if session is not None:
                    session.pop('output_queue', None)
                    session.pop('stop_event_sent', None)

        return Response(
            generate_stream(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'  # 禁用Nginx缓冲[3](@ref)
            }
        )

    except Exception as e:
        logger.error(f"Error in chat stream: {str(e)}")
        return jsonify({'error': str(e)}), 500

@metagpt_bp.route('/api/metagpt/stop/<session_id>', methods=['POST'])
@cross_origin()
def stop_processing(session_id):
    """停止指定会话的处理"""
    try:
        session = project_sessions.get(session_id)
        if session is None:
            return jsonify({'error': 'Session not found'}), 404

        stop_signals[session_id] = True

        output_queue = session.get('output_queue')
        if output_queue is not None:
            mark_stop_event(session_id, output_queue=output_queue)

        return jsonify({
            'success': True,
            'message': f'已发送停止信号给会话 {session_id}',
            'session_id': session_id
        })

    except Exception as e:
        logger.error(f"Error stopping session {session_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500
