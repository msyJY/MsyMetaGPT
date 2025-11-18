import React from 'react';

const SimpleMessageContent = ({ content, isError = false }) => {
  if (!content) return null;

  // 简化的内容处理
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

  const processedContent = processContent(content);

  return (
    <div className={`prose prose-sm max-w-none ${isError ? 'text-red-600' : 'text-gray-700'}`}>
      <div 
        style={{ 
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: '1.6'
        }}
      >
        {processedContent}
      </div>
    </div>
  );
};

export default SimpleMessageContent;

