#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Chat History API Routes
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List
from flask import Blueprint, request, jsonify, current_app
from flask_cors import cross_origin

chat_history_bp = Blueprint('chat_history', __name__)

# 简单的内存存储，实际项目中应该使用数据库
chat_sessions: Dict[str, Dict[str, Any]] = {}

@chat_history_bp.route('/api/metagpt/chat-history', methods=['GET'])
@cross_origin()
def get_chat_history():
    """获取聊天历史记录"""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        
        # 从内存中获取所有会话
        all_sessions = []
        for session_id, session_data in chat_sessions.items():
            if session_data.get('messages'):
                # 获取最后一条消息作为预览
                last_message = session_data['messages'][-1]
                preview = last_message.get('content', '')[:100]
                if len(last_message.get('content', '')) > 100:
                    preview += '...'
                
                session_info = {
                    'id': session_id,
                    'title': session_data.get('project_name', '未命名对话'),
                    'preview': preview,
                    'timestamp': session_data.get('start_time', datetime.now().isoformat()),
                    'message_count': len(session_data['messages']),
                    'status': session_data.get('status', 'completed')
                }
                all_sessions.append(session_info)
        
        # 按时间排序（最新的在前）
        all_sessions.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # 分页
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_sessions = all_sessions[start_idx:end_idx]
        
        return jsonify({
            'conversations': paginated_sessions,
            'total': len(all_sessions),
            'page': page,
            'limit': limit,
            'has_more': end_idx < len(all_sessions)
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting chat history: {str(e)}")
        return jsonify({'error': str(e)}), 500

@chat_history_bp.route('/api/metagpt/chat-history/<session_id>', methods=['GET'])
@cross_origin()
def get_conversation_detail(session_id):
    """获取特定对话的详细信息"""
    try:
        if session_id not in chat_sessions:
            return jsonify({'error': 'Conversation not found'}), 404
        
        session_data = chat_sessions[session_id]
        
        conversation = {
            'id': session_id,
            'title': session_data.get('project_name', '未命名对话'),
            'messages': session_data.get('messages', []),
            'timestamp': session_data.get('start_time', datetime.now().isoformat()),
            'status': session_data.get('status', 'completed'),
            'selected_agents': session_data.get('selected_agents', [])
        }
        
        return jsonify(conversation)
        
    except Exception as e:
        current_app.logger.error(f"Error getting conversation detail: {str(e)}")
        return jsonify({'error': str(e)}), 500

@chat_history_bp.route('/api/metagpt/chat-history/<session_id>', methods=['DELETE'])
@cross_origin()
def delete_conversation(session_id):
    """删除特定对话"""
    try:
        if session_id not in chat_sessions:
            return jsonify({'error': 'Conversation not found'}), 404
        
        del chat_sessions[session_id]
        
        return jsonify({
            'success': True,
            'message': f'Conversation {session_id} deleted successfully'
        })
        
    except Exception as e:
        current_app.logger.error(f"Error deleting conversation: {str(e)}")
        return jsonify({'error': str(e)}), 500

@chat_history_bp.route('/api/metagpt/chat-history', methods=['DELETE'])
@cross_origin()
def clear_all_history():
    """清除所有聊天历史"""
    try:
        chat_sessions.clear()
        
        return jsonify({
            'success': True,
            'message': 'All chat history cleared successfully'
        })
        
    except Exception as e:
        current_app.logger.error(f"Error clearing chat history: {str(e)}")
        return jsonify({'error': str(e)}), 500

def save_session_to_history(session_id: str, session_data: Dict[str, Any]):
    """保存会话到历史记录"""
    chat_sessions[session_id] = session_data

def get_session_from_history(session_id: str) -> Dict[str, Any]:
    """从历史记录获取会话"""
    return chat_sessions.get(session_id, None)

