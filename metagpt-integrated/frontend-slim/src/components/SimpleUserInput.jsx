import React from 'react';

const SimpleUserInput = ({ content }) => {
  if (!content) return null;

  // 精简用户输入的显示
  const processUserInput = (input) => {
    if (!input) return '';
    
    // 移除多余的换行和空格
    let processed = input.trim();
    
    // 如果内容太长，进行截断
    if (processed.length > 200) {
      processed = processed.substring(0, 200) + '...';
    }
    
    return processed;
  };

  const processedContent = processUserInput(content);

  return (
    <div className="text-sm text-gray-700 dark:text-gray-300">
      <div 
        style={{ 
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: '1.4'
        }}
      >
        {processedContent}
      </div>
    </div>
  );
};

export default SimpleUserInput;

