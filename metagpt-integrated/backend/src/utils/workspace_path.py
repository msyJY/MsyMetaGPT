#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Workspace path resolution utilities."""
from __future__ import annotations

import os
from pathlib import Path

from metagpt.config2 import config as metagpt_config

# 默认工作空间目录，指向 JupyterLab 工作目录
DEFAULT_WORKSPACE_PATH = Path("/Users/gedun/Downloads/metagpt-integrated").expanduser()


def resolve_workspace_root() -> Path:
    """Resolve the workspace root by checking env vars, config, then default."""
    env_override = os.getenv("BACKEND_WORKSPACE_PATH") or os.getenv("METAGPT_WORKSPACE_ROOT")
    if env_override:
        candidate = Path(env_override)
    else:
        workspace_cfg = getattr(metagpt_config, "workspace", None)
        candidate = Path(getattr(workspace_cfg, "path", DEFAULT_WORKSPACE_PATH))

    candidate = candidate.expanduser().resolve()
    candidate.mkdir(parents=True, exist_ok=True)

    # 若当前目录为空但存在下级 workspace 子目录，自动切换
    workspace_subdir = candidate / "workspace"
    if workspace_subdir.exists() and workspace_subdir.is_dir() and candidate.name != "workspace":
        try:
            has_workspace_entries = any(workspace_subdir.iterdir())
        except FileNotFoundError:
            has_workspace_entries = False

        if has_workspace_entries:
            candidate = workspace_subdir.resolve()

    return candidate


def resolve_session_workspace(session_id: str, create: bool = False) -> Path:
    """Resolve a per-session workspace path under the root.

    Args:
        session_id: Identifier for the session.
        create: Whether to ensure the directory exists.
    """
    path = (resolve_workspace_root() / session_id).resolve()
    if create:
        path.mkdir(parents=True, exist_ok=True)
    return path
