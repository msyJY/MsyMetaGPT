# -*- coding: utf-8 -*-
"""
文件下载和压缩包功能路由
提供生成文件的下载接口和压缩包下载功能
"""

import json
import logging
import os
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, send_file
from flask_cors import cross_origin
from werkzeug.utils import secure_filename

from utils.workspace_path import resolve_session_workspace, resolve_workspace_root

# 配置日志
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

file_download_bp = Blueprint('file_download', __name__)

WORKSPACE_PATH = resolve_workspace_root()

def get_session_workspace_path(session_id):
    """获取会话的工作空间路径"""
    return resolve_session_workspace(session_id, create=True)

def scan_generated_files(workspace_path):
    """扫描生成的文件"""
    workspace_path = Path(workspace_path).resolve()
    files = []
    if not workspace_path.exists():
        return files
    
    for root, dirs, filenames in os.walk(workspace_path):
        for filename in filenames:
            file_path = Path(root) / filename
            relative_path = os.path.relpath(file_path, workspace_path)
            stat = file_path.stat()
            file_size = stat.st_size
            file_mtime = stat.st_mtime
            
            files.append({
                'name': filename,
                'path': relative_path,
                'size': file_size,
                'modified': datetime.fromtimestamp(file_mtime).isoformat(),
                'type': get_file_type(filename)
            })
    
    return files

def get_file_type(filename):
    """根据文件扩展名判断文件类型"""
    ext = os.path.splitext(filename)[1].lower()
    type_mapping = {
        '.py': 'python',
        '.js': 'javascript',
        '.html': 'html',
        '.css': 'css',
        '.md': 'markdown',
        '.txt': 'text',
        '.json': 'json',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.xml': 'xml',
        '.sql': 'sql',
        '.sh': 'shell',
        '.bat': 'batch',
        '.dockerfile': 'docker',
        '.gitignore': 'git',
        '.env': 'env',
        '.log': 'log'
    }
    return type_mapping.get(ext, 'file')

@file_download_bp.route('/api/files/list/<session_id>', methods=['GET'])
@cross_origin()
def list_generated_files(session_id):
    """列出指定会话生成的文件"""
    try:
        workspace_path = get_session_workspace_path(session_id)
        files = scan_generated_files(workspace_path)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'files': files,
            'total_count': len(files),
            'workspace_path': str(workspace_path)
        })
    
    except Exception as e:
        logger.error(f"Error listing files for session {session_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@file_download_bp.route('/api/files/download/<session_id>/<path:file_path>', methods=['GET'])
@cross_origin()
def download_file(session_id, file_path):
    """下载指定文件"""
    try:
        workspace_path = get_session_workspace_path(session_id)
        full_file_path = (workspace_path / file_path).resolve()
        
        # 安全检查：确保文件在工作空间内
        try:
            full_file_path.relative_to(workspace_path)
        except ValueError:
            return jsonify({'error': 'Invalid file path'}), 400
        
        if not full_file_path.exists():
            return jsonify({'error': 'File not found'}), 404
        
        # 获取安全的文件名
        filename = secure_filename(os.path.basename(file_path))
        
        return send_file(
            str(full_file_path),
            as_attachment=True,
            download_name=filename,
            mimetype='application/octet-stream'
        )
    
    except Exception as e:
        logger.error(f"Error downloading file {file_path} for session {session_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@file_download_bp.route('/api/files/download-zip/<session_id>', methods=['GET'])
@cross_origin()
def download_zip(session_id):
    """下载所有生成文件的压缩包"""
    try:
        workspace_path = get_session_workspace_path(session_id)

        if not workspace_path.exists():
            return jsonify({'error': 'Workspace not found'}), 404
        
        files = scan_generated_files(workspace_path)
        if not files:
            return jsonify({'error': 'No files found'}), 404
        
        # 创建临时压缩文件
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        temp_zip.close()
        
        try:
            with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file_info in files:
                    file_path = (workspace_path / file_info['path']).resolve()
                    if file_path.exists():
                        # 在压缩包中保持相对路径结构
                        zipf.write(str(file_path), file_info['path'])
            
            # 生成压缩包文件名
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            zip_filename = f"generated_files_{session_id[:8]}_{timestamp}.zip"
            
            return send_file(
                temp_zip.name,
                as_attachment=True,
                download_name=zip_filename,
                mimetype='application/zip'
            )
        
        finally:
            # 清理临时文件（在发送完成后）
            def cleanup():
                try:
                    os.unlink(temp_zip.name)
                except:
                    pass
            
            # 注册清理函数
            import atexit
            atexit.register(cleanup)
    
    except Exception as e:
        logger.error(f"Error creating zip for session {session_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@file_download_bp.route('/api/files/info/<session_id>', methods=['GET'])
@cross_origin()
def get_files_info(session_id):
    """获取文件统计信息"""
    try:
        workspace_path = get_session_workspace_path(session_id)
        files = scan_generated_files(workspace_path)
        
        # 统计信息
        total_size = sum(file['size'] for file in files)
        file_types = {}
        for file in files:
            file_type = file['type']
            if file_type not in file_types:
                file_types[file_type] = {'count': 0, 'size': 0}
            file_types[file_type]['count'] += 1
            file_types[file_type]['size'] += file['size']
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'total_files': len(files),
            'total_size': total_size,
            'file_types': file_types,
            'workspace_exists': workspace_path.exists()
        })
    
    except Exception as e:
        logger.error(f"Error getting files info for session {session_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

