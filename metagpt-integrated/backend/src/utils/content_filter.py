"""
内容过滤工具 - 用于过滤MetaGPT输出中的无用信息
"""
import re
import json
from typing import List, Dict, Any, Tuple, Optional, Union

class ContentFilter:
    def __init__(self):
        # 定义需要过滤的无用信息模式
        self.skip_patterns = [
            # 系统初始化信息
            r'^正在初始化.*',
            r'^消息已注入.*',
            r'^开始运行.*',
            r'^检测到异步操作.*',
            r'^正在等待完成.*',
            
            # 日志级别信息
            r'^INFO:.*',
            r'^DEBUG:.*',
            r'^TRACE:.*',
            r'^VERBOSE:.*',
            r'^\[INFO\].*',
            r'^\[DEBUG\].*',
            
            # 空行和无意义内容
            r'^\s*$',
            r'^\.{3,}$',
            r'^-{3,}$',
            r'^={3,}$',
            
            # MetaGPT内部状态信息
            r'.*正在处理中.*',
            r'.*等待响应.*',
            r'.*状态更新.*',
            r'.*内部调用.*',
            # LLM 流式调试信息
            r'^data_preview=.*',
            r'^\[ollama.*',
            r'^[0-9]{4}-[0-9]{2}-[0-9]{2}.*\|\s*(INFO|DEBUG|WARNING)\s*\|.*',
        ]
        
        # 编译正则表达式以提高性能
        self.compiled_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.skip_patterns]

        # 需要从日志中移除的参数化片段（保留对用户有价值的内容）
        self.strip_patterns = [
            re.compile(r"message='[^']*'", re.IGNORECASE),
            re.compile(r"method=\w+", re.IGNORECASE),
            re.compile(r"url=http[^\s]+", re.IGNORECASE),
            re.compile(r"params=\{.*", re.IGNORECASE),
            re.compile(r"options=\{.*", re.IGNORECASE),
            re.compile(r"timeout=\d+", re.IGNORECASE),
            re.compile(r"'stream':\s*(True|False)", re.IGNORECASE),
            re.compile(r"model='[^']*'", re.IGNORECASE),
        ]

        self.data_preview_token = "data_preview="
        
        # 重要内容标识
        self.important_patterns = [
            r'```.*',  # 代码块
            r'#.*',    # 标题
            r'\*\*.*\*\*',  # 粗体文本
            r'ERROR:.*',    # 错误信息
            r'WARN:.*',     # 警告信息
            r'task_id.*',   # 任务信息
            r'instruction.*', # 指令信息
        ]
        
        self.compiled_important = [re.compile(pattern, re.IGNORECASE) for pattern in self.important_patterns]

    def normalize_content(self, content: str) -> List[str]:
        """对原始内容进行预处理，拆分并清洗为更易展示的行"""
        if not content:
            return []

        normalized: List[str] = []
        for raw_line in content.split('\n'):
            normalized.extend(self._normalize_line(raw_line))
        return normalized
    def _normalize_line(self, line: str) -> List[str]:
        if line is None:
            return []

        working = line.strip("\r")
        if not working:
            return [""]

        # 专门处理 data_preview 中的 JSON 片段
        if self.data_preview_token in working:
            prefix, json_payload, suffix = self._extract_data_preview(working)
            collected: List[str] = []

            if prefix:
                collected.extend(self._normalize_line(prefix))

            if json_payload:
                collected.extend(self._summarize_payload(json_payload))

            if suffix:
                collected.extend(self._normalize_line(suffix))

            return collected

        cleaned = working
        for pattern in self.strip_patterns:
            cleaned = pattern.sub("", cleaned)

        cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()

        if not cleaned:
            return []

        decoded = self._decode_escape_sequences(cleaned)
        if not decoded:
            return []

        if "\n" in decoded:
            return decoded.split("\n")

        return [decoded]

    def _extract_data_preview(self, line: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """从包含 data_preview 的行中提取前缀、JSON 内容和后缀"""
        idx = line.find(self.data_preview_token)
        prefix = line[:idx].strip()
        remainder = line[idx + len(self.data_preview_token):].lstrip()

        if not remainder:
            return prefix or None, None, None

        value, suffix = self._extract_quoted_block(remainder)
        if value is None:
            return prefix or None, None, suffix.strip() if suffix else None

        return prefix or None, value, suffix.strip() if suffix else None

    def _extract_quoted_block(self, text: str) -> Tuple[Optional[str], str]:
        if not text:
            return None, ""

        quote_char = text[0]
        if quote_char not in ("'", '"'):
            return None, text

        escaped = False
        for idx in range(1, len(text)):
            char = text[idx]
            if char == quote_char and not escaped:
                return text[1:idx], text[idx + 1 :]
            if char == "\\" and not escaped:
                escaped = True
            else:
                escaped = False

        return text[1:], ""

    def _summarize_payload(self, raw_json: str) -> List[str]:
        try:
            payload = json.loads(raw_json)
        except json.JSONDecodeError:
            # 有些日志中的 JSON 会包含额外的转义，我们做一次兜底处理
            try:
                payload = json.loads(raw_json.encode("utf-8").decode("unicode_escape"))
            except Exception:
                return []

        def stringify_content(content: Union[str, Dict[str, Any], List[Any]]) -> str:
            if content is None:
                return ""
            if isinstance(content, str):
                return self._decode_escape_sequences(content.strip())
            if isinstance(content, dict):
                return self._decode_escape_sequences(json.dumps(content, ensure_ascii=False, indent=2))
            if isinstance(content, list):
                parts: List[str] = []
                for item in content:
                    if isinstance(item, dict):
                        text_value = item.get("text") or item.get("content")
                        if text_value:
                            parts.append(self._decode_escape_sequences(str(text_value).strip()))
                    elif isinstance(item, str):
                        parts.append(self._decode_escape_sequences(item.strip()))
                return "\n".join(filter(None, parts))
            return self._decode_escape_sequences(str(content).strip())

        summaries: List[str] = []

        def emit_multiline(prefix: str, value: str):
            stripped = value.strip('\n')
            if not stripped:
                return
            lines = stripped.splitlines()
            if len(lines) <= 1:
                summaries.append(f"{prefix}: {stripped}")
            else:
                summaries.append(f"{prefix}:")
                summaries.extend(lines)

        if isinstance(payload, dict):
            messages = payload.get("messages")
            if isinstance(messages, list):
                for idx, msg in enumerate(messages, start=1):
                    content = stringify_content(msg.get("content"))
                    if content:
                        prefix = "LLM输入" if idx == 1 else f"LLM上下文{idx}"
                        emit_multiline(prefix, content)

            if "prompt" in payload:
                content = stringify_content(payload.get("prompt"))
                if content:
                    emit_multiline("LLM提示", content)

            if "response" in payload:
                content = stringify_content(payload.get("response"))
                if content:
                    emit_multiline("LLM响应", content)

        elif isinstance(payload, list):
            for idx, item in enumerate(payload, start=1):
                if not isinstance(item, dict):
                    continue
                content = stringify_content(item.get("content") or item.get("text"))
                if content:
                    emit_multiline(f"项{idx}", content)

        return summaries

    def _decode_escape_sequences(self, text: str) -> str:
        if not text or "\\" not in text:
            return text

        decoded = text

        decoded = decoded.replace("\\r", "\r")
        decoded = decoded.replace("\\n", "\n")
        decoded = decoded.replace("\\t", "\t")
        decoded = decoded.replace("\\/", "/")
        decoded = decoded.replace("\\\"", '"')
        decoded = decoded.replace("\\'", "'")

        def _replace_unicode(match: re.Match) -> str:
            try:
                return chr(int(match.group(1), 16))
            except Exception:
                return match.group(0)

        decoded = re.sub(r"\\u([0-9a-fA-F]{4})", _replace_unicode, decoded)

        # 连续的双反斜杠收敛为单个，避免遗留多余的转义
        decoded = decoded.replace("\\\\", "\\")

        return decoded

    def is_important_line(self, line: str) -> bool:
        """判断一行内容是否重要"""
        if not line or not line.strip():
            return False
            
        # 检查是否匹配重要内容模式
        for pattern in self.compiled_important:
            if pattern.search(line):
                return True
                
        # 检查是否应该被过滤
        for pattern in self.compiled_patterns:
            if pattern.match(line.strip()):
                return False
                
        return True

    def filter_content(self, content: str) -> str:
        """过滤内容，移除无用信息"""
        if not content:
            return ""
            
        lines = self.normalize_content(content)
        filtered_lines: List[str] = []

        for line in lines:
            if not line.strip():
                if filtered_lines and filtered_lines[-1] != "":
                    filtered_lines.append("")
                continue

            if self.is_important_line(line):
                filtered_lines.append(line)
                
        return '\n'.join(filtered_lines)

    def extract_structured_content(self, content: str) -> List[Dict[str, Any]]:
        """提取结构化内容"""
        if not content:
            return []
        
        sections = []
        lines = self.normalize_content(content)
        current_section = None
        buffer = []
        
        for line in lines:
            stripped = line.strip()

            # 代码块内的内容优先处理
            if current_section and current_section['type'] == 'code':
                if stripped.startswith('```'):
                    sections.append({
                        'type': 'code',
                        'language': current_section['language'],
                        'content': '\n'.join(current_section['content'])
                    })
                    current_section = None
                else:
                    current_section['content'].append(line)
                continue

            # 检测代码块开始
            if stripped.startswith('```'):
                if buffer:
                    sections.append({
                        'type': 'text',
                        'content': '\n'.join(buffer).strip()
                    })
                    buffer = []

                language = stripped[3:].strip() or 'text'
                current_section = {
                    'type': 'code',
                    'language': language,
                    'content': []
                }
                continue

            # 空行保持段落分隔
            if not stripped:
                if buffer and buffer[-1] != '':
                    buffer.append('')
                continue

            if not self.is_important_line(line):
                continue

            # 检测JSON
            if line.strip().startswith('{') or line.strip().startswith('['):
                try:
                    # 尝试解析JSON
                    json_obj = json.loads(line.strip())
                    
                    # 保存之前的内容
                    if buffer:
                        sections.append({
                            'type': 'text',
                            'content': '\n'.join(buffer).strip()
                        })
                        buffer = []
                        
                    sections.append({
                        'type': 'json',
                        'content': json_obj
                    })
                    continue
                except json.JSONDecodeError:
                    pass
                    
            # 检测错误信息
            if any(keyword in line.lower() for keyword in ['error', 'exception', 'failed', '错误']):
                # 保存之前的内容
                if buffer:
                    sections.append({
                        'type': 'text',
                        'content': '\n'.join(buffer).strip()
                    })
                    buffer = []
                    
                sections.append({
                    'type': 'error',
                    'content': line.strip()
                })
                continue
                
            # 普通文本
            buffer.append(line)
            
        # 处理剩余内容
        if buffer:
            sections.append({
                'type': 'text',
                'content': '\n'.join(buffer).strip()
            })
            
        # 过滤空内容
        return [section for section in sections if section['content']]

    def format_for_display(self, content: str) -> str:
        """格式化内容用于显示"""
        sections = self.extract_structured_content(content)
        formatted_parts: List[str] = []
        for section in sections:
            if section['type'] == 'code':
                formatted_parts.append(f"```{section.get('language', '')}\n{section['content']}\n```")
            elif section['type'] == 'json':
                formatted_parts.append(f"```json\n{json.dumps(section['content'], indent=2, ensure_ascii=False)}\n```")
            elif section['type'] == 'error':
                formatted_parts.append(f"❌ **错误**: {section['content']}")
            else:
                formatted_parts.append(section['content'])

        return '\n\n'.join(formatted_parts)

# 全局过滤器实例
content_filter = ContentFilter()

