import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  User, 
  Bot, 
  Copy, 
  RotateCcw,
  Loader2,
  AlertCircle,
  Paperclip,
  X
} from 'lucide-react';
import MessageContent from './MessageContentNew';
import FileUpload from './FileUpload';
import { metaGPTAPI } from '../services/api';

const ChatInterface = ({ selectedAgents = ['product_manager', 'architect', 'ProjectManager'], onRequestCollapseSidebar }) => {
  const activeAgents = Array.isArray(selectedAgents) ? selectedAgents : [];
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const scrollAreaRef = useRef(null);
  const textareaRef = useRef(null);

  // 初始化时不显示任何欢迎消息，等待用户输入

  // 自动滚动到底部
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          // 使用 smooth 滚动
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth'
          });
        }
      }
    };

    // 延迟执行以确保DOM更新完成
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // 监听消息变化，确保新消息时滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === 'assistant') {
        // 对于AI回复，延迟更长时间以确保内容渲染完成
        const timeoutId = setTimeout(() => {
          if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
              scrollContainer.scrollTo({
                top: scrollContainer.scrollHeight,
                behavior: 'smooth'
              });
            }
          }
        }, 300);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [messages]);

  // 处理发送消息
  const handleSend = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;
    if (activeAgents.length === 0) {
      setError('请至少选择一个智能体角色');
      return;
    }

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setUploadedFiles([]);
    setShowFileUpload(false);
    setIsLoading(true);
    setError(null);
    // 在用户消息入队后立即折叠侧边栏以改善体验
    if (typeof onRequestCollapseSidebar === 'function') {
      try { console.log('ChatInterface: calling onRequestCollapseSidebar'); onRequestCollapseSidebar(); } catch (e) { /* ignore */ }
    }

    // dispatch a global event as a fallback
    try { window.dispatchEvent(new Event('metagpt:collapseSidebar')); } catch(e) {}

    try {
      // 准备发送的数据，包含文件信息
      const messageData = {
        message: userMessage.content,
        files: uploadedFiles.map(file => ({
          name: file.name,
          type: file.type,
          size: file.size,
          content: file.content
        }))
      };

      // 调用MetaGPT API
      const response = await metaGPTAPI.sendMessage(userMessage.content, {
        selectedAgents: activeAgents,
        stream: false,
        files: messageData.files
      });

      const assistantMessage = {
        id: response.id || Date.now() + 1,
        type: 'assistant',
        content: response.message,
        timestamp: new Date(response.timestamp || Date.now()),
    role: 'multi_agent',
    agents: response.agents || activeAgents,
        team_type: response.team_type || 'default'
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('发送消息失败:', err);
      setError('发送消息失败，请检查网络连接或API配置');
      
      // 添加错误消息
      const errorMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: `抱歉，发送消息时出现错误：${err.message}。请检查网络连接或API配置。`,
        timestamp: new Date(),
        role: 'system',
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理文件上传
  const handleFileUpload = (file) => {
    setUploadedFiles(prev => [...prev, file]);
  };

  // 处理文件移除
  const handleFileRemove = (file) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== file.id));
  };

  // 移除单个已上传文件
  const removeUploadedFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // 处理键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 复制消息内容
  const copyMessage = (content) => {
    navigator.clipboard.writeText(content);
  };

  // 重新生成回复
  const regenerateResponse = async (messageIndex) => {
    const userMessage = messages[messageIndex - 1];
    if (!userMessage || userMessage.type !== 'user') return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await metaGPTAPI.sendMessage(userMessage.content, {
        selectedAgents: activeAgents,
        stream: false
      });

      const newAssistantMessage = {
        id: Date.now(),
        type: 'assistant',
        content: response.message,
        timestamp: new Date(response.timestamp || Date.now()),
        role: 'multi_agent',
        agents: response.agents || activeAgents
      };

      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[messageIndex] = newAssistantMessage;
        return newMessages;
      });
    } catch (err) {
      console.error('重新生成回复失败:', err);
      setError('重新生成回复失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 获取角色显示名称
  const getRoleName = (role, agents) => {
    if (role === 'system') return '系统';
    if (role === 'multi_agent' && agents) {
      const agentNames = {
        'product_manager': '产品经理',
        'architect': '架构师',
        'engineer': '工程师',
        'qa_engineer': '测试工程师',
        'project_manager': '项目经理',
        'data_interpreter': '数据解释器'
      };
      return agents.map(id => agentNames[id] || id).join(' + ');
    }
    return '智能助手';
  };

  return (
    <div className="flex flex-col h-full">
      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="ml-auto"
          >
            ×
          </Button>
        </div>
      )}
      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="p-4">
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex space-x-3 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    {/* Avatar */}
                    <Avatar className="w-8 h-8 mt-1">
                      <AvatarFallback>
                        {message.type === 'user' ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>

                    {/* Message Content */}
                    <Card
                      className={`p-4 ${
                        message.type === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : message.isError
                              ? 'bg-destructive/10 border-destructive/20'
                              : 'bg-card'
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Role Badge */}
                        {message.role && message.type === 'assistant' && (
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {getRoleName(message.role, message.agents)}
                            </Badge>
                            {message.team_type && (
                              <Badge variant="secondary" className="text-xs">
                                {message.team_type === 'default'
                                  ? '标准团队'
                                  : message.team_type === 'innovative'
                                    ? '创新团队'
                                    : message.team_type === 'enterprise'
                                      ? '企业团队'
                                      : message.team_type === 'academic'
                                        ? '学术团队'
                                        : message.team_type}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Message Text */}
                        <MessageContent content={message.content} thinkingContent={message.thinkingContent} files={message.files} />

                        {/* Message Actions */}
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-muted-foreground">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                          {message.type === 'assistant' && !message.isError && (
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyMessage(message.content)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => regenerateResponse(index)}
                                disabled={isLoading}
                              >
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              ))}

          {/* Loading Message */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex space-x-3 max-w-[80%]">
                <Avatar className="w-8 h-8 mt-1">
                  <AvatarFallback>
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <Card className="p-4 bg-card">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">团队正在协作思考...</span>
                  </div>
                </Card>
              </div>
            </div>
          )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* 文件上传区域 */}
          {showFileUpload && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium">上传文件</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFileUpload(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <FileUpload
                onFileUpload={handleFileUpload}
                onFileRemove={handleFileRemove}
                maxFiles={3}
                maxSize={10 * 1024 * 1024} // 10MB
              />
            </Card>
          )}

          {/* 已上传文件显示 */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file) => (
                <Badge
                  key={file.id}
                  variant="secondary"
                  className="flex items-center gap-1 px-2 py-1"
                >
                  <span className="text-xs truncate max-w-20">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUploadedFile(file.id)}
                    className="h-4 w-4 p-0 hover:bg-transparent"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}

          {/* 输入框和按钮 */}
          <div className="flex space-x-2">
            <div className="flex-1">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的项目需求，比如：创建一个2048游戏..."
                className="min-h-[60px] max-h-[200px] resize-none"
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowFileUpload(!showFileUpload)}
                className="px-3"
                title="上传文件"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleSend}
                disabled={(!input.trim() && uploadedFiles.length === 0) || isLoading}
                size="lg"
                className="px-6"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            按 Enter 发送，Shift + Enter 换行 | 支持上传文件进行分析
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;