import React from 'react';
import ContentParser from './ContentParser';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, FileText, FileCode, FileImage, FileSpreadsheet, File } from 'lucide-react';

const MessageContentNew = ({ content, files, isError = false, isStreaming = false, compact = false, thinkingContent = '' }) => {
  // 获取文件图标
  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return FileImage;
    if (type.includes('text/') || type.includes('json')) return FileCode;
    if (type.includes('sheet') || type.includes('csv')) return FileSpreadsheet;
    if (type.includes('pdf') || type.includes('document')) return FileText;
    return File;
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* 错误提示 */}
      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            处理过程中出现错误，请检查输入内容或稍后重试。
          </AlertDescription>
        </Alert>
      )}

      {/* 思考内容 */}
      {thinkingContent && thinkingContent.trim() && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <span role="img" aria-label="thinking">🤔</span>
            思考过程
          </h4>
          <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <pre className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-5 m-0">
              {thinkingContent}
            </pre>
          </div>
        </div>
      )}

      {/* 文件附件 */}
      {files && files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">附件文件</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {files.map((file, index) => {
              const IconComponent = getFileIcon(file.type);
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <IconComponent className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)} • {file.type}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 主要内容 - 使用新的ContentParser */}
      <ContentParser content={content} isStreaming={isStreaming} compact={compact} />
    </div>
  );
};

export default MessageContentNew;

