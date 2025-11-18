import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot } from 'lucide-react';

const SimpleStreamingMessage = ({ content, isComplete = false }) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const contentRef = useRef(null);

  // 简化的内容处理 - 移除复杂的JSON解析和Mermaid渲染
  const processContent = (rawContent) => {
    if (!rawContent) return '';
    
    // 移除[CONTENT]标签
    let processed = rawContent.replace(/\[CONTENT\]([\s\S]*?)\[\/CONTENT\]/g, '$1');
    
    // 简化代码块显示
    processed = processed.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `\n[代码块${lang ? ` - ${lang}` : ''}]\n${code.trim()}\n`;
    });
    
    // 移除多余的换行
    processed = processed.replace(/\n{3,}/g, '\n\n');
    
    return processed.trim();
  };

  useEffect(() => {
    const processedContent = processContent(content);
    
    if (isComplete) {
      setDisplayedContent(processedContent);
      setIsTyping(false);
    } else {
      setDisplayedContent(processedContent);
      setIsTyping(true);
    }
  }, [content, isComplete]);

  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [displayedContent]);

  if (!content) {
    return (
      <Card className="p-4 bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse mx-auto mb-2"></div>
            <p className="text-sm">等待响应...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="flex space-x-3 max-w-[90%]">
        {/* AI头像 */}
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback className="bg-blue-100">
            <Bot className="w-4 h-4 text-blue-600" />
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* 消息头部 */}
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-sm font-medium text-gray-700">AI 助手</span>
            {isTyping && (
              <div className="flex items-center space-x-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-500">输出中</span>
              </div>
            )}
          </div>

          {/* 消息内容 */}
          <Card className="p-4 bg-white border border-gray-200 shadow-sm">
            <div 
              ref={contentRef}
              className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
              style={{ 
                maxHeight: '400px', 
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {displayedContent}
              {isTyping && (
                <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1"></span>
              )}
            </div>

            {/* 输出状态指示器 */}
            {isTyping && (
              <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-gray-100">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-gray-500">AI 正在思考和生成内容...</span>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SimpleStreamingMessage;

