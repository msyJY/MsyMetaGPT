import mimetypes
import os
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

from flask import Blueprint, jsonify, make_response, send_file

from utils.workspace_path import resolve_workspace_root

workspace_files_bp = Blueprint('workspace_files', __name__)

# 获取workspace目录路径
def get_workspace_path():
    """获取workspace目录的绝对路径"""
    return str(resolve_workspace_root())

def get_file_type_icon(filename):
    """根据文件扩展名返回文件类型图标"""
    ext = os.path.splitext(filename)[1].lower()
    
    icon_map = {
        '.py': 'file-code',
        '.js': 'file-code',
        '.jsx': 'file-code',
        '.ts': 'file-code',
        '.tsx': 'file-code',
        '.html': 'file-code',
        '.css': 'file-code',
        '.json': 'file-code',
        '.xml': 'file-code',
        '.yaml': 'file-code',
        '.yml': 'file-code',
        '.md': 'file-text',
        '.txt': 'file-text',
        '.pdf': 'file-text',
        '.doc': 'file-text',
        '.docx': 'file-text',
        '.jpg': 'image',
        '.jpeg': 'image',
        '.png': 'image',
        '.gif': 'image',
        '.svg': 'image',
        '.mp4': 'video',
        '.avi': 'video',
        '.mov': 'video',
        '.mp3': 'music',
        '.wav': 'music',
        '.zip': 'archive',
        '.tar': 'archive',
        '.gz': 'archive',
        '.rar': 'archive',
    }
    
    return icon_map.get(ext, 'file')

def scan_directory(directory_path, base_path=""):
    """递归扫描目录，返回文件和文件夹结构"""
    items = []
    
    try:
        for item in sorted(os.listdir(directory_path)):
            if item.startswith('.'):  # 跳过隐藏文件
                continue
                
            item_path = os.path.join(directory_path, item)
            relative_path = os.path.join(base_path, item) if base_path else item
            
            if os.path.isdir(item_path):
                # 文件夹
                folder_info = {
                    'name': item,
                    'type': 'folder',
                    'path': relative_path,
                    'icon': 'folder',
                    'children': scan_directory(item_path, relative_path),
                    'size': 0,
                    'modified': datetime.fromtimestamp(os.path.getmtime(item_path)).isoformat()
                }
                items.append(folder_info)
            else:
                # 文件
                file_size = os.path.getsize(item_path)
                file_info = {
                    'name': item,
                    'type': 'file',
                    'path': relative_path,
                    'icon': get_file_type_icon(item),
                    'size': file_size,
                    'modified': datetime.fromtimestamp(os.path.getmtime(item_path)).isoformat()
                }
                items.append(file_info)
    except PermissionError:
        pass
    
    return items

@workspace_files_bp.route('/api/workspace/files', methods=['GET'])
def list_workspace_files():
    """列出workspace目录中的所有文件和文件夹"""
    try:
        workspace_path = get_workspace_path()
        
        if not os.path.exists(workspace_path):
            return jsonify({
                'success': False,
                'error': 'Workspace目录不存在',
                'files': []
            }), 404
        
        files = scan_directory(workspace_path)
        
        # 统计信息
        total_files = 0
        total_size = 0
        
        def count_files(items):
            nonlocal total_files, total_size
            for item in items:
                if item['type'] == 'file':
                    total_files += 1
                    total_size += item['size']
                elif item['type'] == 'folder' and 'children' in item:
                    count_files(item['children'])
        
        print(files)
        count_files(files)
        
        response = make_response(jsonify({
            'success': True,
            'files': files,
            'stats': {
                'total_files': total_files,
                'total_size': total_size,
                'workspace_path': workspace_path
            }
        }))
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'获取文件列表失败: {str(e)}',
            'files': []
        }), 500

@workspace_files_bp.route('/api/workspace/download/<path:file_path>', methods=['GET'])
def download_workspace_file(file_path):
    """下载workspace中的单个文件"""
    try:
        workspace_path = Path(get_workspace_path())
        full_path = (workspace_path / file_path).resolve()
        
        # 安全检查：确保文件在workspace目录内
        try:
            full_path.relative_to(workspace_path)
        except ValueError:
            return jsonify({'error': '非法的文件路径'}), 400
        
        if not full_path.exists():
            return jsonify({'error': '文件不存在'}), 404
        
        if full_path.is_dir():
            return jsonify({'error': '不能下载文件夹，请使用压缩包下载'}), 400
        
        # 获取MIME类型
        mime_type, _ = mimetypes.guess_type(str(full_path))
        if mime_type is None:
            mime_type = 'application/octet-stream'
        
        return send_file(
            str(full_path),
            as_attachment=True,
            download_name=os.path.basename(file_path),
            mimetype=mime_type
        )
        
    except Exception as e:
        return jsonify({'error': f'下载文件失败: {str(e)}'}), 500

@workspace_files_bp.route('/api/workspace/download-zip', methods=['GET'])
def download_workspace_zip():
    """下载整个workspace目录的压缩包"""
    try:
        workspace_path = Path(get_workspace_path())
        
        if not workspace_path.exists():
            return jsonify({'error': 'Workspace目录不存在'}), 404
        
        # 创建临时压缩文件
        temp_dir = tempfile.gettempdir()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        zip_filename = f'workspace_{timestamp}.zip'
        zip_path = os.path.join(temp_dir, zip_filename)
        
        # 创建压缩包
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(workspace_path):
                # 跳过隐藏文件和目录
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                files = [f for f in files if not f.startswith('.')]
                
                for file in files:
                    file_path = Path(root) / file
                    # 计算相对路径
                    arcname = os.path.relpath(file_path, workspace_path)
                    zipf.write(str(file_path), arcname)
        
        return send_file(
            zip_path,
            as_attachment=True,
            download_name=zip_filename,
            mimetype='application/zip'
        )
        
    except Exception as e:
        return jsonify({'error': f'创建压缩包失败: {str(e)}'}), 500

@workspace_files_bp.route('/api/workspace/info', methods=['GET'])
def get_workspace_info():
    """获取workspace目录的基本信息"""
    try:
        workspace_path = Path(get_workspace_path())
        
        if not workspace_path.exists():
            return jsonify({
                'success': False,
                'error': 'Workspace目录不存在',
                'info': {}
            }), 404
        
        # 统计文件和大小
        total_files = 0
        total_size = 0
        
        for root, dirs, files in os.walk(workspace_path):
            # 跳过隐藏文件和目录
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            files = [f for f in files if not f.startswith('.')]
            
            for file in files:
                file_path = Path(root) / file
                if file_path.exists():
                    total_files += 1
                    total_size += file_path.stat().st_size
        
        return jsonify({
            'success': True,
            'info': {
                'workspace_path': str(workspace_path),
                'total_files': total_files,
                'total_size': total_size,
                'last_modified': datetime.fromtimestamp(workspace_path.stat().st_mtime).isoformat() if workspace_path.exists() else None
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'获取workspace信息失败: {str(e)}',
            'info': {}
        }), 500
