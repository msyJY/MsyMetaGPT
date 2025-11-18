#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
LLM配置覆盖模块
用于硬编码指定的大模型设置
大模型生效的生效的位置在这里
"""

import os
from metagpt.configs.llm_config import LLMConfig, LLMType
from enum import Enum
from dataclasses import dataclass


os.environ["METAGPT_LLM_API_TYPE"] = "ollama"
os.environ["METAGPT_LLM_BASE_URL"] = "http://localhost:11434"
os.environ["METAGPT_LLM_API_KEY"] = ""
os.environ["METAGPT_LLM_MODEL"] = "deepseek-r1:7b"
ollama_suffix = os.environ.setdefault("METAGPT_OLLAMA_SUFFIX", "/api/chat")


# 增加/修改默认配置以支持本地 ollama
class LLMApiType(str, Enum):
    DEEPSEEK = "DeepSeek"
    AZCANGJ = "CangJ"
    OLLAMA = "ollama"

@dataclass
class LLMConfig:
    api_type: LLMApiType
    base_url: str
    api_key: str | None
    model: str
    max_token: int = 4096
    temperature: float = 0.0
    top_p: float = 1.0
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    timeout: int = 600

def apply_llm_config_override() -> LLMConfig:
    """
    返回 LLM 配置，优先读取环境变量；默认指向本地 ollama 服务（如本机运行 ollama）。
    若你使用其他云服务，请在环境变量中设置 METAGPT_LLM_API_TYPE / METAGPT_LLM_BASE_URL / METAGPT_LLM_API_KEY / METAGPT_LLM_MODEL
    """
    api_type = os.environ.get("METAGPT_LLM_API_TYPE", "ollama").lower()
    base_url = os.environ.get("METAGPT_LLM_BASE_URL", "http://localhost:11434")
    api_key = os.environ.get("METAGPT_LLM_API_KEY", "")
    model = os.environ.get("METAGPT_LLM_MODEL", "deepseek-r1:7b")  # 根据你本地 Ollama 模型名称替换

    # 归一化类型
    if api_type == "ollama":
        api_type_enum = LLMApiType.OLLAMA
    elif api_type == "deepseek":
        api_type_enum = LLMApiType.DEEPSEEK
    else:
        api_type_enum = LLMApiType.CangJ

    return LLMConfig(
        api_type=api_type_enum,
        base_url=base_url,
        api_key=api_key,
        model=model,
    )

# 在模块导入时自动应用配置
_llm_config = apply_llm_config_override()

def get_config():
    """获取当前的LLM配置"""
    return _llm_config
