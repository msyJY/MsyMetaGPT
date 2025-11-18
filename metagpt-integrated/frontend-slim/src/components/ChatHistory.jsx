import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  MessageSquare, 
  Calendar, 
  Clock, 
  Trash2, 
  Download,
  Filter,
  ChevronRight,
  Bot,
  User,
  FileText
} from 'lucide-react';
import { metaGPTAPI } from '../services/api';

const ChatHistory = ({ onSelectConversation, onClose }) => {
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, today, week, month
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);

  // 加载对话历史
  useEffect(() => {
    loadChatHistory();
  }, []);

  // 搜索和过滤
  useEffect(() => {
    filterConversations();
  }, [conversations, searchTerm, selectedFilter]);

  const loadChatHistory = async () => {
    try {
      setLoading(true);
      
      // 首先尝试从本地存储加载
      const localConversations = JSON.parse(localStorage.getItem('metagpt_conversations_list') || '[]');
      
      if (localConversations.length > 0) {
        setConversations(localConversations);
        setLoading(false);
        return;
      }
      
      // 如果本地没有数据，尝试从后端加载
      try {
        const response = await metaGPTAPI.getChatHistory();
        console.log('Chat history response:', response);
        
        // 转换后端数据格式为前端需要的格式
        const formattedConversations = (response.data || []).map(chat => ({
          id: chat.id,
          title: chat.user_message.substring(0, 50) + (chat.user_message.length > 50 ? '...' : ''),
          preview: chat.assistant_message.substring(0, 100) + (chat.assistant_message.length > 100 ? '...' : ''),
          timestamp: chat.created_at,
          agents: chat.agents || [],
          team_type: chat.team_type || 'default',
          user_message: chat.user_message,
          assistant_message: chat.assistant_message,
          project_id: chat.project_id,
          messages: [
            {
              id: `user-${chat.id}`,
              type: 'user',
              content: chat.user_message,
              timestamp: chat.created_at,
              role: 'user'
            },
            {
              id: `assistant-${chat.id}`,
              type: 'assistant',
              content: chat.assistant_message,
              timestamp: chat.created_at,
              role: 'assistant',
              agents: chat.agents
            }
          ]
        }));
        
        setConversations(formattedConversations);
        
        // 保存到本地存储
        localStorage.setItem('metagpt_conversations_list', JSON.stringify(formattedConversations));
      } catch (apiError) {
        console.error('从后端加载聊天历史失败:', apiError);
        setConversations([]);
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  // 过滤对话
  const filterConversations = () => {
    let filtered = conversations;

    // 按时间过滤
    const now = new Date();
    if (selectedFilter === 'today') {
      filtered = filtered.filter(conv => {
        const convDate = new Date(conv.timestamp);
        return convDate.toDateString() === now.toDateString();
      });
    } else if (selectedFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(conv => new Date(conv.timestamp) >= weekAgo);
    } else if (selectedFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(conv => new Date(conv.timestamp) >= monthAgo);
    }

    // 按搜索词过滤
    if (searchTerm) {
      filtered = filtered.filter(conv =>
        conv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.preview.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredConversations(filtered);
  };

  // 格式化时间
  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return time.toLocaleDateString('zh-CN');
    }
  };

  // 获取状态颜色
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // 获取状态文本
  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'in_progress': return '进行中';
      case 'error': return '错误';
      default: return '未知';
    }
  };

  // 获取智能体名称
  const getAgentName = (agentId) => {
    const names = {
      'product_manager': '产品经理',
      'architect': '架构师',
      'engineer': '工程师',
      'qa_engineer': '测试工程师',
      'project_manager': '项目经理',
      'team_leader': '团队负责人'
    };
    return names[agentId] || agentId;
  };

  // 选择对话
  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    if (onSelectConversation) {
      onSelectConversation(conversation);
    }
  };

  // 删除对话
  const handleDeleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个对话吗？')) {
      try {
        // 从本地存储删除
        const localConversations = JSON.parse(localStorage.getItem('metagpt_conversations_list') || '[]');
        const updatedConversations = localConversations.filter(conv => conv.id !== conversationId);
        localStorage.setItem('metagpt_conversations_list', JSON.stringify(updatedConversations));
        
        // 更新状态
        setConversations(prev => prev.filter(conv => conv.id !== conversationId));
        
        // 尝试从后端删除（如果失败也不影响本地删除）
        try {
          await metaGPTAPI.deleteConversation(conversationId);
        } catch (apiError) {
          console.warn('从后端删除对话失败，但本地删除成功:', apiError);
        }
      } catch (error) {
        console.error('删除对话失败:', error);
      }
    }
  };

  // 导出对话
  const handleExportConversation = async (conversation, e) => {
    e.stopPropagation();
    try {
      const data = await metaGPTAPI.exportConversation(conversation.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${conversation.title}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出对话失败:', error);
    }
  };

  // 下载生成的文件
  const handleDownloadFiles = async (conversation, e) => {
    e.stopPropagation();
    try {
      if (!conversation.sessionId) {
        console.warn('对话没有关联的sessionId');
        return;
      }
      
      // 直接下载压缩包
      const response = await fetch(`/api/files/download-zip/${conversation.sessionId}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // 生成文件名
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const filename = `files_${conversation.title.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.zip`;
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errorData = await response.json();
        console.error('下载文件失败:', errorData.error);
      }
    } catch (error) {
      console.error('下载文件失败:', error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">聊天历史</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>

        {/* 搜索框 */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索对话..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* 过滤器 */}
        <div className="flex space-x-2">
          {[
            { key: 'all', label: '全部' },
            { key: 'today', label: '今天' },
            { key: 'week', label: '本周' },
            { key: 'month', label: '本月' }
          ].map(filter => (
            <Button
              key={filter.key}
              variant={selectedFilter === filter.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedFilter(filter.key)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea 
          className="h-full"
          style={{ 
            maxHeight: 'calc(100vh - 300px)',
            overflowY: 'auto'
          }}
        >
          <div className="p-4 space-y-3" style={{ paddingBottom: '20px' }}>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">加载中...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? '没有找到匹配的对话' : '暂无聊天历史'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <Card
                  key={conversation.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedConversation?.id === conversation.id ? 'ring-2 ring-primary' : ''
                  }`}
                  style={{ marginBottom: '12px' }}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* 标题和状态 */}
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-medium truncate">{conversation.title}</h3>
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(conversation.status)}`} />
                          {conversation.hasFiles && (
                            <FileText className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>

                        {/* 预览文本 */}
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {conversation.preview}
                        </p>

                        {/* 智能体标签和团队类型 */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {conversation.agents.map((agent) => (
                            <Badge key={agent} variant="secondary" className="text-xs">
                              {getAgentName(agent)}
                            </Badge>
                          ))}
                          {conversation.team_type && conversation.team_type !== 'default' && (
                            <Badge variant="outline" className="text-xs">
                              {conversation.team_type === 'innovative' ? '创新团队' :
                               conversation.team_type === 'enterprise' ? '企业团队' :
                               conversation.team_type === 'academic' ? '学术团队' : conversation.team_type}
                            </Badge>
                          )}
                        </div>

                        {/* 底部信息 */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatTime(conversation.timestamp)}</span>
                            </div>
                            {conversation.project_id && (
                              <div className="flex items-center space-x-1">
                                <FileText className="w-3 h-3" />
                                <span>关联项目</span>
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex flex-col space-y-1 ml-2">
                        {conversation.sessionId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDownloadFiles(conversation, e)}
                            className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700"
                            title="下载生成的文件"
                          >
                            <FileText className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleExportConversation(conversation, e)}
                          className="h-6 w-6 p-0"
                          title="导出对话"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteConversation(conversation.id, e)}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          title="删除对话"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 底部统计 */}
      <div className="p-4 border-t bg-muted/50">
        <div className="text-xs text-muted-foreground text-center">
          共 {filteredConversations.length} 个对话
          {searchTerm && ` (搜索: "${searchTerm}")`}
        </div>
      </div>
    </div>
  );
};

export default ChatHistory;

