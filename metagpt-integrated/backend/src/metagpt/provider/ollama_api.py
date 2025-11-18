#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Desc   : self-host open llm model with ollama which isn't openai-api-compatible

import json
import asyncio
import os
import requests
from typing import Any

from metagpt.configs.llm_config import LLMConfig, LLMType
from metagpt.const import USE_CONFIG_TIMEOUT
from metagpt.logs import log_llm_stream, logger
from metagpt.provider.base_llm import BaseLLM
from metagpt.provider.general_api_requestor import GeneralAPIRequestor
from metagpt.provider.llm_provider_registry import register_provider
from metagpt.utils.cost_manager import TokenCostManager


@register_provider(LLMType.OLLAMA)
class OllamaLLM(BaseLLM):
    """
    Refs to `https://github.com/jmorganca/ollama/blob/main/docs/api.md#generate-a-chat-completion`
    """

    def __init__(self, config: LLMConfig):
        self.config = config
        suffix_env = os.environ.get("METAGPT_OLLAMA_SUFFIX")
        if suffix_env:
            self.suffix_url = suffix_env if suffix_env.startswith("/") else f"/{suffix_env}"
        else:
            self.suffix_url = "/chat"  # default suffix before detection
        # print("suffix_url是 : ", self.suffix_url)
        self.__init_ollama(config)
        self.client = GeneralAPIRequestor(base_url=config.base_url)
        self.http_method = "post"
        self.use_system_prompt = False
        self.cost_manager = TokenCostManager()

    def __init_ollama(self, config: LLMConfig):
        assert config.base_url, "ollama base url is required!"
        self.model = config.model
        self.pricing_plan = self.model
        # 自动检测 provider 的正确路径（避免 base_url + suffix 导致的 404）
        if not os.environ.get("METAGPT_OLLAMA_SUFFIX"):
            try:
                detected = self._detect_suffix(config.base_url)
                if detected:
                    # detected may return a suffix starting with '/'
                    self.suffix_url = detected
            except Exception as e:
                # 如果检测失败，保留默认/用户指定 suffix
                logger.warning(f"[ollama endpoint detect error] {e}")

    def _const_kwargs(self, messages: list[dict], stream: bool = False) -> dict:
        kwargs = {"model": self.model, "messages": messages, "options": {"temperature": 0.3}, "stream": stream}
        return kwargs

    def _detect_suffix(self, base_url: str) -> str:
        """Try common Ollama endpoints and return the first that doesn't 404.

        Uses a short POST probe with stream=False. Returns the suffix (like '/v1/chat' or '/chat') or
        an empty string if none found.
        """
        candidates = [
            "/api/chat",
            "/api/v1/chat",
            "/v1/chat",
            "/chat",
            "/api/generate",
            "/api/v1/generate",
            "/v1/generate",
            "/generate",
            "/api/complete",
            "/api/v1/complete",
            "/v1/complete",
            "/complete",
        ]
        base = base_url.rstrip("/")
        probe_payload = {"model": self.model, "messages": [{"role": "user", "content": "ping"}], "stream": False}
        timeout = float(os.environ.get("METAGPT_OLLAMA_SUFFIX_PROBE_TIMEOUT", 5))
        for suf in candidates:
            url = f"{base}{suf}"
            try:
                resp = requests.post(url, json=probe_payload, timeout=timeout)
                status = resp.status_code
                # Accept 200, 201, 202, 204 as success; also accept 405 (method not allowed but endpoint exists)
                if status in {200, 201, 202, 204, 405}:
                    logger.debug(f"[ollama endpoint detect] try {url} -> {status}")
                    return suf
                logger.debug(f"[ollama endpoint detect] try {url} -> {status}")
            except requests.exceptions.RequestException as e:
                logger.debug(f"[ollama endpoint detect] try {url} -> error {e}")
                continue
        return ""

    def get_choice_text(self, resp: dict) -> str:
        """get the resp content from llm response"""
        assist_msg = resp.get("message", {})
        assert assist_msg.get("role", None) == "assistant"
        return assist_msg.get("content")

    def get_usage(self, resp: dict) -> dict:
        return {"prompt_tokens": resp.get("prompt_eval_count", 0), "completion_tokens": resp.get("eval_count", 0)}

    def _decode_and_load(self, chunk: bytes, encoding: str = "utf-8") -> dict:
        """
        兼容 bytes/str/dict 的解析：
        - dict: 直接返回
        - bytes/bytearray: decode -> try json.loads
        - str: try json.loads
        如果解析失败，返回包含原始文本的兼容 dict
        """
        if isinstance(chunk, dict):
            return chunk
        if isinstance(chunk, (bytes, bytearray)):
            text = chunk.decode(encoding, errors="ignore")
        else:
            text = str(chunk)
        # 首先尝试直接解析整个文本
        try:
            obj = json.loads(text)
            # 如果解析结果不是 dict（例如 JSON 数字/字符串），把它包装成兼容结构
            if isinstance(obj, dict):
                return obj
            else:
                return {"message": {"role": "assistant", "content": str(obj)}}
        except json.JSONDecodeError:
            # 处理 NDJSON 或多个 JSON 串连在一起的情况：尝试使用 raw_decode 解析第一个 JSON 对象
            try:
                decoder = json.JSONDecoder()
                obj, idx = decoder.raw_decode(text)
                if isinstance(obj, dict):
                    return obj
                else:
                    return {"message": {"role": "assistant", "content": str(obj)}}
            except Exception:
                # 如果仍然无法解析，降级为把整个文本作为 content 返回
                return {"message": {"role": "assistant", "content": text}}
        except Exception:
            return {"message": {"role": "assistant", "content": text}}
    async def _achat_completion(self, messages: list[dict], timeout: int = USE_CONFIG_TIMEOUT) -> dict:
        resp, _, _ = await self.client.arequest(
            method=self.http_method,
            url=self.suffix_url,
            params=self._const_kwargs(messages),
            request_timeout=self.get_timeout(timeout),
        )
        resp = self._decode_and_load(resp)
        usage = self.get_usage(resp)
        self._update_costs(usage)
        return resp

    async def acompletion(self, messages: list[dict], timeout=USE_CONFIG_TIMEOUT) -> dict:
        return await self._achat_completion(messages, timeout=self.get_timeout(timeout))

    async def _achat_completion_stream(self, messages: list[dict], timeout: int = USE_CONFIG_TIMEOUT) -> str:
        stream_resp, _, _ = await self.client.arequest(
            method=self.http_method,
            url=self.suffix_url,
            stream=True,
            params=self._const_kwargs(messages, stream=True),
            request_timeout=self.get_timeout(timeout),
        )

        collected_content = []
        usage = {}
        # 遍历时兼容多种返回类型：async iterable / bytes / sync iterator
        debug_chunk_logging = os.environ.get("METAGPT_OLLAMA_DEBUG") == "1"
        try:
            async for raw_chunk in _ensure_async_iter(stream_resp):
                raw_text = None
                try:
                    # log chunk type for debugging（默认关闭，需设置 METAGPT_OLLAMA_DEBUG=1 才打印）
                    if debug_chunk_logging:
                        logger.debug(
                            "data_preview={} message='Received chunk' type={}",
                            repr(raw_chunk)[:300],
                            type(raw_chunk),
                        )

                    # 早期检测常见的 HTTP 错误文本（例如 404 page not found），避免尝试解析为 JSON
                    if isinstance(raw_chunk, (bytes, bytearray)):
                        try:
                            raw_text = raw_chunk.decode('utf-8', errors='ignore')
                        except Exception:
                            raw_text = str(raw_chunk)
                    elif isinstance(raw_chunk, str):
                        raw_text = raw_chunk

                    if raw_text and ("404" in raw_text.lower() or "page not found" in raw_text.lower()):
                        # logger.error(f"[ollama http error detected] {raw_text}")
                        logger.error(f"ollama 接口网络连接异常，处理中....")
                        # 抛出异常，由上层捕获并按错误流程处理
                        raise RuntimeError(f"ollama 接口网络连接异常，处理中")

                    chunk = self._decode_and_load(raw_chunk)
                except Exception as e:
                    logger.error(f"ollama 生成内容解析错误，处理中 {e} ")
                    # fallback to a safe dict，保证后续逻辑可继续执行
                    if raw_text is None:
                        if isinstance(raw_chunk, (bytes, bytearray)):
                            try:
                                raw_text = raw_chunk.decode('utf-8', errors='ignore')
                            except Exception:
                                raw_text = str(raw_chunk)
                        else:
                            raw_text = str(raw_chunk)
                    chunk = {"message": {"role": "assistant", "content": raw_text or ""}}

                try:
                    if not chunk:
                        continue

                    error_msg = chunk.get("error")
                    if error_msg:
                        error_lower = str(error_msg).lower()
                        if "stopped by user" in error_lower or "cancelled" in error_lower or "canceled" in error_lower:
                            logger.info(f"[ollama stream stopped] {error_msg}")
                        else:
                            logger.error(f"[ollama stream error chunk] {error_msg}")
                        break

                    if not chunk.get("done", False):
                        try:
                            content = self.get_choice_text(chunk)
                        except Exception:
                            content = chunk.get("message", {}).get("content", str(chunk))
                        collected_content.append(content)
                        log_llm_stream(content)
                    else:
                        usage = self.get_usage(chunk)
                except Exception as e:
                    err_text = str(e)
                    exc_name = getattr(e, "__class__", type(e)).__name__
                    if "stopped by user" in err_text.lower() or exc_name == "ProcessingStopped":
                        logger.info(f"[ollama stream stopped] {err_text}")
                        break
                    logger.warning(f"[ollama stream parse error] {e}")
                    continue
        except Exception as e:
            # 捕获来自 arequest 或迭代器的异常，避免整个流程崩溃
            logger.error(f"[ollama stream error] {e}")
        log_llm_stream("\n")

        self._update_costs(usage)
        full_content = "".join(collected_content)
        return full_content


async def _ensure_async_iter(stream_resp: Any):
    """Ensure stream_resp can be iterated with `async for`.
    Supports:
      - already async iterable -> yield from it
      - bytes/str -> yield once
      - sync iterable -> run in executor to avoid blocking loop
    """
    if stream_resp is None:
        return
    # already async iterable
    if hasattr(stream_resp, "__aiter__"):
        async for it in stream_resp:
            yield it
        return

    # bytes/str -> single yield
    if isinstance(stream_resp, (bytes, bytearray, str)):
        # 将 bytes/str 按行拆分，针对 NDJSON 或多 JSON 对象的情况逐行产出
        if isinstance(stream_resp, (bytes, bytearray)):
            try:
                text = stream_resp.decode("utf-8", errors="ignore")
            except Exception:
                text = str(stream_resp)
        else:
            text = stream_resp

        lines = [ln for ln in text.splitlines() if ln.strip()]
        if len(lines) <= 1:
            # 单行或无法拆分，直接产出原始类型
            yield stream_resp
            return
        # 多行：逐行产出（string 类型），让上层逐个解析
        for ln in lines:
            yield ln
        return

    # sync iterable -> iterate in thread executor
    if hasattr(stream_resp, "__iter__"):
        loop = asyncio.get_event_loop()
        iterator = iter(stream_resp)
        while True:
            try:
                next_item = await loop.run_in_executor(None, lambda it=iterator: next(it))
                yield next_item
            except StopIteration:
                break
        return

    raise TypeError(f"Unsupported stream_resp type: {type(stream_resp)}")
