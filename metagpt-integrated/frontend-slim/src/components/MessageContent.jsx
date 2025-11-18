import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, FileText, FileCode, FileImage, FileSpreadsheet, File, AlertTriangle, Info, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import remarkGfm from 'remark-gfm';

const MessageContent = ({ content, files, isError = false, isStreaming = false }) => {
  const [copiedCode, setCopiedCode] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [collapsedSections, setCollapsedSections] = useState(new Set());

  // 检测内容类型
  const detectContentType = (text) => {
    if (!text) return 'text';
    
    // 检测错误信息
    if (text.includes('Error:') || text.includes('错误:') || text.includes('Exception:') || text.includes('Traceback')) {
      return 'error';
    }
    
    // 检测代码块
    if (text.includes('```') || text.match(/^\s*def\s+|^\s*class\s+|^\s*import\s+|^\s*from\s+/m)) {
      return 'code';
    }
    
    // 检测JSON
    if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
      try {
        JSON.parse(text);
        return 'json';
      } catch (e) {
        // 不是有效JSON
      }
    }
    
    // 检测列表或步骤
    if (text.match(/^\s*[\d\-\*\+]\s+/m) || text.includes('步骤') || text.includes('Step')) {
      return 'list';
    }
    
    return 'text';
  };

  const contentType = detectContentType(content);

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

  // 复制代码块
  const copyCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(index);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // 切换折叠状态
  const toggleCollapse = (id) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(id)) {
      newCollapsed.delete(id);
    } else {
      newCollapsed.add(id);
    }
    setCollapsedSections(newCollapsed);
  };

  // 自定义代码块组件
  const CodeBlock = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const code = String(children).replace(/\n$/, '');
    const codeIndex = `${language}-${code.slice(0, 20)}`;
    const lineCount = code.split('\n').length;
    const isLongCode = lineCount > 10;
    const isCollapsed = collapsedSections.has(codeIndex);

    if (!inline && match) {
      return (
        <div className="relative group my-6 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <FileCode className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-sm">{language || 'code'}</span>
              <Badge variant="outline" className="text-xs">
                {lineCount} 行
              </Badge>
              {isLongCode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCollapse(codeIndex)}
                  className="h-6 px-2 text-xs"
                >
                  {isCollapsed ? (
                    <>
                      <ChevronRight className="w-3 h-3 mr-1" />
                      展开
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 mr-1" />
                      折叠
                    </>
                  )}
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyCode(code, codeIndex)}
              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {copiedCode === codeIndex ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
          {(!isLongCode || !isCollapsed) && (
            <div className="relative">
              <SyntaxHighlighter
                style={isDarkMode ? oneDark : oneLight}
                language={language}
                PreTag="div"
                className="!mt-0 !mb-0 !rounded-none"
                showLineNumbers={lineCount > 5}
                customStyle={{
                  margin: 0,
                  padding: '1rem',
                  background: isDarkMode ? '#1e1e1e' : '#fafafa',
                  fontSize: '0.875rem',
                  lineHeight: '1.5'
                }}
                {...props}
              >
                {code}
              </SyntaxHighlighter>
            </div>
          )}
          {isLongCode && isCollapsed && (
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
              代码已折叠，点击展开查看完整内容
            </div>
          )}
        </div>
      );
    }

    return (
      <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono border text-gray-800 dark:text-gray-200" {...props}>
        {children}
      </code>
    );
  };

  // 自定义表格组件
  const Table = ({ children }) => (
    <div className="overflow-x-auto my-6 rounded-lg border border-gray-200 shadow-sm">
      <table className="w-full border-collapse bg-white dark:bg-gray-900">
        {children}
      </table>
    </div>
  );

  const TableHead = ({ children }) => (
    <thead className="bg-gray-50 dark:bg-gray-800">
      {children}
    </thead>
  );

  const TableRow = ({ children }) => (
    <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      {children}
    </tr>
  );

  const TableCell = ({ children, ...props }) => (
    <td className="px-4 py-3 text-left text-sm" {...props}>
      {children}
    </td>
  );

  const TableHeaderCell = ({ children, ...props }) => (
    <th className="px-4 py-3 text-left font-semibold text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100" {...props}>
      {children}
    </th>
  );

  // 自定义链接组件
  const Link = ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium transition-colors"
    >
      {children}
    </a>
  );

  // 自定义列表组件
  const List = ({ ordered, children }) => {
    const Component = ordered ? 'ol' : 'ul';
    return (
      <Component className={`ml-6 my-4 space-y-2 ${ordered ? 'list-decimal' : 'list-disc'}`}>
        {children}
      </Component>
    );
  };

  const ListItem = ({ children }) => (
    <li className="my-2 leading-relaxed text-gray-700 dark:text-gray-300">{children}</li>
  );

  // 自定义标题组件
  const Heading = ({ level, children }) => {
    const Component = `h${level}`;
    const sizes = {
      1: 'text-3xl font-bold mt-8 mb-6 pb-3 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100',
      2: 'text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-400',
      3: 'text-xl font-semibold mt-6 mb-3 text-gray-800 dark:text-gray-200',
      4: 'text-lg font-semibold mt-5 mb-3 text-gray-800 dark:text-gray-200',
      5: 'text-base font-semibold mt-4 mb-2 text-gray-800 dark:text-gray-200',
      6: 'text-sm font-semibold mt-3 mb-2 text-gray-800 dark:text-gray-200'
    };

    return React.createElement(Component, {
      className: sizes[level] || sizes[1]
    }, children);
  };

  // 自定义引用块组件
  const Blockquote = ({ children }) => (
    <blockquote className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 pl-6 py-4 my-6 italic text-gray-700 dark:text-gray-300 rounded-r-lg">
      {children}
    </blockquote>
  );

  // 自定义分隔线组件
  const Hr = () => (
    <hr className="my-8 border-gray-200 dark:border-gray-700" />
  );

  // 自定义段落组件
  const Paragraph = ({ children }) => (
    <p className="my-4 leading-relaxed text-gray-700 dark:text-gray-300 text-base">
      {children}
    </p>
  );

  // 渲染特殊内容类型
  const renderSpecialContent = () => {
    if (isError || contentType === 'error') {
      return (
        <Alert className="border-destructive/50 bg-destructive/10">
          <XCircle className="h-4 w-4" />
          <AlertDescription className="font-mono text-sm whitespace-pre-wrap">
            {content}
          </AlertDescription>
        </Alert>
      );
    }

    if (contentType === 'json') {
      try {
        const jsonData = JSON.parse(content);
        return (
          <div className="my-4">
            <div className="flex items-center space-x-2 mb-2">
              <FileCode className="w-4 h-4" />
              <span className="text-sm font-medium">JSON 数据</span>
            </div>
            <SyntaxHighlighter
              language="json"
              style={isDarkMode ? oneDark : oneLight}
              className="border rounded-md"
            >
              {JSON.stringify(jsonData, null, 2)}
            </SyntaxHighlighter>
          </div>
        );
      } catch (e) {
        // 如果解析失败，按普通文本处理
      }
    }

    return null;
  };

  return (
    <div className="space-y-4">
      {/* 流式输出指示器 */}
      {isStreaming && (
        <div className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 mb-3 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="font-medium">实时输出中...</span>
        </div>
      )}

      {/* 文件显示 */}
      {files && files.length > 0 && (
        <div className="space-y-3 mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <FileText className="w-4 h-4" />
            <span className="font-medium">附件文件:</span>
          </div>
          <div className="grid gap-3">
            {files.map((file, index) => {
              const Icon = getFileIcon(file.type);
              return (
                <Card key={index} className="p-4 hover:shadow-md transition-all duration-200 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <Icon className="w-6 h-6 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{file.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                    </Badge>
                  </div>
                  
                  {/* 文件内容预览 */}
                  {file.content && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      {file.content.type === 'image' && (
                        <img 
                          src={file.content.data} 
                          alt={file.name}
                          className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                          style={{ maxHeight: '200px' }}
                        />
                      )}
                      {file.content.type === 'text' && (
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-sm font-mono max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700">
                          <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                            {file.content.data.substring(0, 500)}
                            {file.content.data.length > 500 && '...'}
                          </pre>
                        </div>
                      )}
                      {file.content.type === 'json' && (
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-sm font-mono max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700">
                          <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                            {JSON.stringify(file.content.data, null, 2).substring(0, 500)}
                            {JSON.stringify(file.content.data, null, 2).length > 500 && '...'}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 特殊内容类型渲染 */}
      {renderSpecialContent() || (
        /* Markdown 内容 */
        <div className="prose prose-base max-w-none dark:prose-invert prose-gray">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: CodeBlock,
              table: Table,
              thead: TableHead,
              tr: TableRow,
              td: TableCell,
              th: TableHeaderCell,
              a: Link,
              ul: ({ children }) => <List ordered={false}>{children}</List>,
              ol: ({ children }) => <List ordered={true}>{children}</List>,
              li: ListItem,
              h1: ({ children }) => <Heading level={1}>{children}</Heading>,
              h2: ({ children }) => <Heading level={2}>{children}</Heading>,
              h3: ({ children }) => <Heading level={3}>{children}</Heading>,
              h4: ({ children }) => <Heading level={4}>{children}</Heading>,
              h5: ({ children }) => <Heading level={5}>{children}</Heading>,
              h6: ({ children }) => <Heading level={6}>{children}</Heading>,
              blockquote: Blockquote,
              hr: Hr,
              p: Paragraph,
              strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
              em: ({ children }) => <em className="italic text-gray-700 dark:text-gray-300">{children}</em>
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default MessageContent;

