import React from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, AlertCircle, Code, Terminal, FileText, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const StreamingMessage = ({ content, isComplete = false }) => {
  // 解析流式内容，识别不同类型的信息
  const parseStreamContent = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const parsedContent = [];
    
    for (let line of lines) {
      // 尝试解析JSON
      if (line.startsWith('{') || line.startsWith('[')) {
        try {
          const jsonData = JSON.parse(line);
          parsedContent.push({
            type: 'json',
            content: jsonData,
            raw: line
          });
          continue;
        } catch (e) {
          // 不是有效JSON，继续其他解析
        }
      }
      
      // 检测错误信息
      if (line.toLowerCase().includes('error') || 
          line.toLowerCase().includes('exception') || 
          line.toLowerCase().includes('failed') ||
          line.toLowerCase().includes('错误')) {
        parsedContent.push({
          type: 'error',
          content: line
        });
        continue;
      }
      
      // 检测代码块
      if (line.includes('```') || 
          line.includes('def ') || 
          line.includes('class ') ||
          line.includes('function ') ||
          line.includes('import ') ||
          line.includes('from ')) {
        parsedContent.push({
          type: 'code',
          content: line
        });
        continue;
      }
      
      // 检测系统消息
      if (line.includes('正在') || 
          line.includes('开始') || 
          line.includes('完成') ||
          line.includes('处理') ||
          line.includes('初始化')) {
        parsedContent.push({
          type: 'system',
          content: line
        });
        continue;
      }
      
      // 检测任务信息
      if (line.includes('task_id') || 
          line.includes('instruction') || 
          line.includes('task_type')) {
        parsedContent.push({
          type: 'task',
          content: line
        });
        continue;
      }
      
      // 默认为普通文本
      parsedContent.push({
        type: 'text',
        content: line
      });
    }
    
    return parsedContent;
  };

  const renderContentItem = (item, index) => {
    const { type, content, raw } = item;
    
    switch (type) {
      case 'error':
        return (
          <div key={index} className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <Badge variant="destructive" className="text-xs mb-1">错误</Badge>
              <p className="text-sm text-red-700 font-mono">{content}</p>
            </div>
          </div>
        );
        
      case 'code':
        return (
          <div key={index} className="flex items-start space-x-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <Code className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <Badge variant="secondary" className="text-xs mb-1">代码</Badge>
              <pre className="text-sm text-gray-800 font-mono whitespace-pre-wrap overflow-x-auto">
                {content}
              </pre>
            </div>
          </div>
        );
        
      case 'system':
        return (
          <div key={index} className="flex items-start space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Terminal className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <Badge variant="outline" className="text-xs mb-1">系统</Badge>
              <p className="text-sm text-blue-700">{content}</p>
            </div>
          </div>
        );
        
      case 'task':
        return (
          <div key={index} className="flex items-start space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <Zap className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <Badge variant="outline" className="text-xs mb-1 border-green-300 text-green-700">任务</Badge>
              <pre className="text-sm text-green-700 font-mono whitespace-pre-wrap overflow-x-auto">
                {content}
              </pre>
            </div>
          </div>
        );
        
      case 'json':
        return (
          <div key={index} className="flex items-start space-x-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <FileText className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <Badge variant="outline" className="text-xs mb-1 border-purple-300 text-purple-700">数据</Badge>
              <pre className="text-sm text-purple-700 font-mono whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(content, null, 2)}
              </pre>
            </div>
          </div>
        );
        
      default:
        return (
          <div key={index} className="p-2">
            <p className="text-sm text-gray-700 leading-relaxed">{content}</p>
          </div>
        );
    }
  };

  const parsedContent = parseStreamContent(content);

  return (
    <div className="flex items-start space-x-3">
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarFallback className="bg-primary text-primary-foreground">
          <Bot className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-sm font-medium">AI团队</span>
          {!isComplete && (
            <Badge variant="outline" className="text-xs animate-pulse">
              正在处理...
            </Badge>
          )}
        </div>
        
        <Card className="p-4 bg-white border border-gray-200">
          <div className="space-y-3">
            {parsedContent.map((item, index) => renderContentItem(item, index))}
          </div>
          
          {!isComplete && (
            <div className="mt-3 flex items-center space-x-2 text-xs text-gray-500">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>实时输出中...</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default StreamingMessage;

