import React, { useState, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Copy, 
  Check, 
  Download, 
  Play, 
  ChevronDown, 
  ChevronUp,
  Code,
  FileText,
  Maximize2,
  Minimize2
} from 'lucide-react';

const EnhancedCodeBlock = ({ 
  code, 
  language = '', 
  startLine = 1,
  title,
  showLineNumbers = true,
  maxHeight = 400,
  collapsible = true
}) => {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const codeRef = useRef(null);

  // 检测代码语言
  const detectLanguage = (code, hint = '') => {
    if (hint) return hint.toLowerCase();
    
    // 简单的语言检测
    if (code.includes('def ') || code.includes('import ') || code.includes('from ')) return 'python';
    if (code.includes('function ') || code.includes('const ') || code.includes('let ')) return 'javascript';
    if (code.includes('public class') || code.includes('import java')) return 'java';
    if (code.includes('#include') || code.includes('int main')) return 'cpp';
    if (code.includes('SELECT') || code.includes('FROM')) return 'sql';
    if (code.includes('<html>') || code.includes('<div>')) return 'html';
    if (code.includes('{') && code.includes('}') && code.includes(':')) return 'json';
    
    return 'text';
  };

  const detectedLanguage = detectLanguage(code, language);
  const lineCount = code.split('\n').length;
  const shouldShowCollapse = collapsible && lineCount > 15;

  // 获取语言图标和颜色
  const getLanguageInfo = (lang) => {
    const langMap = {
      python: { icon: '🐍', color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' },
      javascript: { icon: '📜', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' },
      typescript: { icon: '📘', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' },
      java: { icon: '☕', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300' },
      cpp: { icon: '⚡', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300' },
      html: { icon: '🌐', color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' },
      css: { icon: '🎨', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-300' },
      sql: { icon: '🗄️', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300' },
      json: { icon: '📋', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
      bash: { icon: '💻', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
      default: { icon: '📄', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' }
    };
    return langMap[lang] || langMap.default;
  };

  const langInfo = getLanguageInfo(detectedLanguage);

  // 复制代码
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 下载代码文件
  const downloadCode = () => {
    const extensions = {
      python: 'py',
      javascript: 'js',
      typescript: 'ts',
      java: 'java',
      cpp: 'cpp',
      html: 'html',
      css: 'css',
      sql: 'sql',
      json: 'json',
      bash: 'sh'
    };
    
    const ext = extensions[detectedLanguage] || 'txt';
    const filename = title ? `${title}.${ext}` : `code.${ext}`;
    
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 判断是否可以运行代码
  const isExecutable = (lang) => {
    return ['python', 'javascript', 'sql'].includes(lang);
  };

  const displayCode = isCollapsed ? code.split('\n').slice(0, 10).join('\n') + '\n...' : code;
  const displayHeight = isExpanded ? 'none' : `${maxHeight}px`;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">
              {title || '代码块'}
            </CardTitle>
            <Badge className={`text-xs ${langInfo.color}`}>
              {langInfo.icon} {detectedLanguage.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {lineCount} 行
            </Badge>
          </div>
          
          <div className="flex items-center gap-1">
            {isExecutable(detectedLanguage) && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                title="运行代码"
              >
                <Play className="h-3 w-3" />
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCode}
              className="h-7 px-2"
              title="下载代码"
            >
              <Download className="h-3 w-3" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={copyCode}
              className="h-7 px-2"
              title="复制代码"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 px-2"
              title={isExpanded ? "收起" : "展开"}
            >
              {isExpanded ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="relative">
          <div 
            className="overflow-auto rounded-md border"
            style={{ maxHeight: displayHeight }}
          >
            <SyntaxHighlighter
              language={detectedLanguage}
              style={isDarkMode ? oneDark : oneLight}
              showLineNumbers={showLineNumbers}
              startingLineNumber={startLine}
              customStyle={{
                margin: 0,
                padding: '1rem',
                fontSize: '0.875rem',
                lineHeight: '1.5'
              }}
              lineNumberStyle={{
                minWidth: '3em',
                paddingRight: '1em',
                color: '#6b7280',
                userSelect: 'none'
              }}
            >
              {displayCode}
            </SyntaxHighlighter>
          </div>
          
          {shouldShowCollapse && (
            <div className="flex justify-center mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-6 px-3 text-xs"
              >
                {isCollapsed ? (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    展开全部 ({lineCount - 10} 行)
                  </>
                ) : (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    收起代码
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>
            {startLine > 1 && `从第 ${startLine} 行开始 • `}
            语法高亮: {detectedLanguage}
          </span>
          <div className="flex items-center gap-2">
            <span>📋 复制</span>
            <span>💾 下载</span>
            {isExecutable(detectedLanguage) && <span>▶️ 运行</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedCodeBlock;

