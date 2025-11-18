import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import mermaid from 'mermaid';
import { Copy, Check, ChevronDown, ChevronUp, Compass, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import 'katex/dist/katex.min.css';

// 专业的Mermaid主题配置
const mermaidConfig = {
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    // 基础颜色 - 极简灰色调
    primaryColor: '#f8fafc',
    primaryTextColor: '#1e293b',
    primaryBorderColor: '#e2e8f0',
    lineColor: '#64748b',

    // 背景色
    background: '#ffffff',
    mainBkg: '#f8fafc',
    secondBkg: '#f1f5f9',
    tertiaryColor: '#f8fafc',

    // 文字颜色
    textColor: '#334155',
    darkTextColor: '#1e293b',

    // 节点样式
    nodeBkg: '#ffffff',
    nodeBorder: '#cbd5e1',
    clusterBkg: '#f8fafc',
    clusterBorder: '#e2e8f0',

    // 图表特定颜色
    quadrant1Fill: '#f0f9ff',
    quadrant2Fill: '#f0fdf4', 
    quadrant3Fill: '#fefce8',
    quadrant4Fill: '#fef2f2',
    quadrant1TextFill: '#0369a1',
    quadrant2TextFill: '#166534',
    quadrant3TextFill: '#a16207',
    quadrant4TextFill: '#dc2626',
    quadrantPointFill: '#64748b',
    quadrantPointTextFill: '#1e293b',
    quadrantXAxisTextFill: '#64748b',
    quadrantYAxisTextFill: '#64748b',
    quadrantTitleFill: '#1e293b',

    // 其他图表元素
    pieSectionTextColor: '#1e293b',
    pieTitleTextSize: '16px',
    pieTitleTextColor: '#1e293b',
    pieStrokeColor: '#e2e8f0',
    pieStrokeWidth: '1px',

    // 流程图
    edgeLabelBackground: '#ffffff',
    actorBorder: '#cbd5e1',
    actorBkg: '#f8fafc',
    actorTextColor: '#1e293b',
    actorLineColor: '#64748b',
    signalColor: '#64748b',
    signalTextColor: '#1e293b',
    labelBoxBkgColor: '#f8fafc',
    labelBoxBorderColor: '#cbd5e1',
    labelTextColor: '#1e293b',
    loopTextColor: '#1e293b',
    noteBorderColor: '#cbd5e1',
    noteBkgColor: '#f8fafc',
    noteTextColor: '#1e293b',

    // Git图
    git0: '#3b82f6',
    git1: '#10b981',
    git2: '#f59e0b',
    git3: '#ef4444',
    git4: '#8b5cf6',
    git5: '#06b6d4',
    git6: '#84cc16',
    git7: '#f97316',

    // 甘特图
    gridColor: '#e2e8f0',
    section0: '#f0f9ff',
    section1: '#f0fdf4',
    section2: '#fefce8',
    section3: '#fef2f2',
    altSection0: '#e0f2fe',
    altSection1: '#dcfce7',
    altSection2: '#fef3c7',
    altSection3: '#fee2e2',

    // 类图
    classText: '#1e293b',

    // 状态图
    labelColor: '#1e293b',

    // 用户旅程图
    fillType0: '#f0f9ff',
    fillType1: '#f0fdf4',
    fillType2: '#fefce8',
    fillType3: '#fef2f2',
    fillType4: '#f3e8ff',
    fillType5: '#ecfdf5',
    fillType6: '#fffbeb',
    fillType7: '#fef7f7'
  },
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  fontSize: 14,
  quadrantChart: {
    chartWidth: 500,
    chartHeight: 400,
    titleFontSize: 16,
    titlePadding: 10,
    quadrantPadding: 5,
    quadrantTextTopPadding: 5,
    quadrantLabelFontSize: 12,
    quadrantInternalBorderStrokeWidth: 1,
    quadrantExternalBorderStrokeWidth: 2,
    quadrantTitlePadding: 5,
    pointTextPadding: 5,
    pointLabelFontSize: 11,
    pointRadius: 4,
    xAxisLabelPadding: 5,
    xAxisLabelFontSize: 11,
    yAxisLabelPadding: 5,
    yAxisLabelFontSize: 11
  }
};

// 初始化Mermaid
mermaid.initialize(mermaidConfig);

// 独立的Mermaid图表组件
const MermaidChart = ({ code, title, type, onCopy }) => {
  const chartRef = useRef(null);
  const [isRendered, setIsRendered] = useState(false);
  const [renderError, setRenderError] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const chartId = useMemo(() => 
    `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []
  );

  const handleDownload = useCallback(() => {
    try {
      setIsDownloading(true);
      const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fname = (title || 'mermaid').replace(/\s+/g, '_') + '.mmd';
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('下载失败:', err);
    } finally {
      setTimeout(() => setIsDownloading(false), 300);
    }
  }, [code, title]);

  const renderChart = useCallback(async () => {
    if (!chartRef.current || isRendered) return;

    try {
      setRenderError(null);

      // 清空容器
      chartRef.current.innerHTML = '';

      // 显示加载状态
      chartRef.current.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; color: #64748b; padding: 20px;">
          <div style="width: 20px; height: 20px; border: 2px solid #e2e8f0; border-top: 2px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></div>
          正在渲染图表...
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;

      // 等待DOM更新
      await new Promise(resolve => setTimeout(resolve, 100));

      // 重新初始化Mermaid
      await mermaid.initialize(mermaidConfig);

      // 特殊处理quadrantChart
      if (code.includes('quadrantChart') || code.toLowerCase().includes('quadrant')) {
        const quadrantConfig = {
          ...mermaidConfig,
          quadrantChart: {
            ...mermaidConfig.quadrantChart,
            useMaxWidth: true,
            useMaxHeight: true
          }
        };
        await mermaid.initialize(quadrantConfig);
      }

      // 渲染图表
      const { svg } = await mermaid.render(chartId, code);

      // 清空容器并插入SVG
      chartRef.current.innerHTML = '';
      chartRef.current.innerHTML = svg;

      // 优化SVG样式
      const svgElement = chartRef.current.querySelector('svg');
      if (svgElement) {
        svgElement.style.maxWidth = '100%';
        svgElement.style.height = 'auto';
        svgElement.style.backgroundColor = 'transparent';
        svgElement.style.display = 'block';
        svgElement.style.margin = '0 auto';

        // quadrantChart特殊样式
        if (code.includes('quadrantChart') || code.toLowerCase().includes('quadrant')) {
          svgElement.style.minHeight = '400px';
          svgElement.style.minWidth = '500px';
        }
      }

      setIsRendered(true);
      console.log(`✅ Mermaid图表渲染成功: ${chartId}`);
    } catch (error) {
      console.error('❌ Mermaid渲染错误:', error);
      setRenderError(error.message);

      // 显示错误信息
      if (chartRef.current) {
        chartRef.current.innerHTML = `
          <div style="padding: 16px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626;">
            <div style="font-weight: 600; margin-bottom: 8px;">图表渲染失败</div>
            <div style="font-size: 14px; background-color: #fee2e2
              ${error.message}
            </div>
            <details style="margin-top: 8px;">
              <summary style="cursor: pointer; font-size: 14px; font-weight: 500;">查看源代码</summary>
              <pre style="margin-top: 8px; font-size: 12px; background-color: #fee2e2; padding: 8px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">${code}</pre>
            </details>
          </div>
        `;
      }
    }
  }, [code, chartId, isRendered]);

  useEffect(() => {
    // 延迟渲染确保DOM准备就绪
    const timer = setTimeout(renderChart, 200);
    return () => clearTimeout(timer);
  }, [renderChart]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      if (onCopy) onCopy(code);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const getTypeLabel = () => {
    if (code.includes('quadrantChart')) return '象限图';
    if (code.includes('classDiagram')) return '类图';
    if (code.includes('sequenceDiagram')) return '时序图';
    if (code.includes('flowchart') || code.includes('graph')) return '流程图';
    return 'Mermaid图';
  };

  // 在这里替换或调整部分样式与配色（使整体更收敛、字体更小、不重要信息置灰）
  // 主要改动点：
  // - 整体消息面板字体变小（text-sm -> text-xs/text-sm 更收敛）
  // - 元信息/徽章颜色变淡（使用 slate/gray 而非鲜艳色）
  // - 代码块与 mermaid 区域字体及 padding 缩小
  // - Avatar 缩小，Card 内所有 contentBlocks 保持在同一个 Card 中（避免分散）
  const getTypeColor = () => {
    if (code.includes('quadrantChart')) return { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
    if (code.includes('classDiagram')) return { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
    if (code.includes('sequenceDiagram')) return { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
    return { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
  };
  const typeColor = getTypeColor();

  return (
    <div className="mb-4">
      {/* 图表头部 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className={`w-2.5 h-2.5 ${typeColor.dot} rounded-full`}></div>
          <span className="text-sm font-medium text-slate-700">{title}</span>
          <span className={`text-xs ${typeColor.text} ${typeColor.bg} px-2 py-0.5 rounded-full font-medium ml-2`}>
            {getTypeLabel()}
          </span>
          <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full ml-2">
            {code.split('\n').length} 行
          </span>
          {renderError && (
            <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-medium ml-2">
              渲染失败
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 px-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
          >
            下载
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 图表渲染区域 */}
      <div className="bg-white border border-slate-100 rounded-md p-4 shadow-sm">
        <div
          ref={chartRef}
          className="text-center"
          style={{
            minHeight: code.includes('quadrantChart') ? '360px' : '160px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff'
          }}
        >
          {!isRendered && !renderError && (
            <div className="text-slate-500 text-sm">
              <div className="w-6 h-6 bg-slate-200 rounded-full animate-pulse mx-auto mb-1"></div>
              <div className="text-xs">正在渲染图表...</div>
            </div>
          )}
        </div>
      </div>

      {/* 源代码（可折叠） */}
      <div className="mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-7 px-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
        >
          {isCollapsed ? (
            <>
              <ChevronDown className="w-4 h-4 mr-1" />
              显示源代码
            </>
          ) : (
            <>
              <ChevronUp className="w-4 h-4 mr-1" />
              隐藏源代码
            </>
          )}
        </Button>

        {!isCollapsed && (
          <div className="mt-2 bg-slate-50 border border-slate-100 rounded-md overflow-hidden">
            <SyntaxHighlighter
              style={oneLight}
              language="mermaid"
              PreTag="div"
              customStyle={{
                margin: 0,
                padding: '12px',
                background: '#f8fafc',
                fontSize: '12px',
                lineHeight: '1.4'
              }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    </div>
  );
};

const EnhancedStreamingMessage = ({
  content,
  statusLines = [],
  thinkingContent = '',
  isThinkingActive = false,
  isComplete = false,
  compact = false,
  sessionMode = 'unknown'
}) => {
  const [copiedStates, setCopiedStates] = useState({});
  const [collapsedStates, setCollapsedStates] = useState({});
  const [thinkingCollapsed, setThinkingCollapsed] = useState(false);
  const [codeCollapsed, setCodeCollapsed] = useState(false);
  const SUCCESS_LABEL = '任务代码仓库生成成功';

  // 流式JSON解析 - 支持不完整的JSON
  const isChatSession = sessionMode === 'chat';

  const parseStreamingJSON = useCallback((rawContent) => {
    if (!rawContent) {
      return { parsedContent: '', contentBlocks: [], partialContent: '' };
    }

    if (sessionMode === 'chat') {
      return {
        parsedContent: rawContent.replace(/\r/g, ''),
        contentBlocks: [],
        partialContent: ''
      };
    }

    // 查找所有完整的[CONTENT]...[/CONTENT]块
    const completeContentRegex = /\[CONTENT\]([\s\S]*?)\[\/CONTENT\]/g;
    const contentBlocks = [];
    let match;

    // 处理完整的内容块
    while ((match = completeContentRegex.exec(rawContent)) !== null) {
      const contentText = match[1].trim();
      try {
        const jsonData = JSON.parse(contentText);
        contentBlocks.push({
          type: 'json',
          data: jsonData,
          raw: contentText,
          complete: true
        });
      } catch (e) {
        contentBlocks.push({
          type: 'text',
          data: contentText,
          raw: contentText,
          complete: true
        });
      }
    }

    // 查找不完整的[CONTENT]块（没有对应的[/CONTENT]）
    const incompleteMatch = rawContent.match(/\[CONTENT\]([\s\S]*?)(?!\[\/CONTENT\])$/);
    let partialContent = '';

    if (incompleteMatch && !isComplete) {
      const partialText = incompleteMatch[1].trim();

      // 尝试解析不完整的JSON
      try {
        // 检查是否可能是JSON开始
        if (partialText.startsWith('{')) {
          // 尝试修复不完整的JSON
          let fixedJson = partialText;

          // 简单的JSON修复策略
          const openBraces = (fixedJson.match(/\{/g) || []).length;
          const closeBraces = (fixedJson.match(/\}/g) || []).length;

          // 如果缺少闭合括号，尝试添加
          if (openBraces > closeBraces) {
            fixedJson += '}';
          }

          // 尝试解析修复后的JSON
          try {
            const partialJsonData = JSON.parse(fixedJson);
            contentBlocks.push({
              type: 'json',
              data: partialJsonData,
              raw: partialText,
              complete: false,
              partial: true
            });
          } catch (e) {
            // 如果修复失败，作为部分文本处理
            partialContent = partialText;
          }
        } else {
          partialContent = partialText;
        }
      } catch (e) {
        partialContent = partialText;
      }
    }

    // 移除所有[CONTENT]块后的剩余内容
    const remainingContent = rawContent
      .replace(completeContentRegex, '')
      .replace(/\[CONTENT\][\s\S]*$/, '')
      .replace(/\[\/?CONTENT\]/gi, '')
      .trim();

    return {
      parsedContent: remainingContent,
      contentBlocks: contentBlocks,
      partialContent: partialContent.replace(/\[\/?CONTENT\]/gi, '')
    };
  }, [sessionMode, isComplete]);

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }));
      }, 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const toggleCollapse = (id) => {
    setCollapsedStates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 提取 Markdown 中的代码块
  const extractCodeBlocks = useCallback((md) => {
    const blocks = [];
    if (!md) return blocks;
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let m;
    while ((m = regex.exec(md)) !== null) {
      blocks.push({ language: (m[1] || 'plaintext'), code: (m[2] || '').trim() });
    }
    return blocks;
  }, []);

  // 自定义代码块组件
  const CodeBlock = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;
    const code = String(children).replace(/\n$/, '');
    const isCollapsed = collapsedStates[codeId];
    const isCopied = copiedStates[codeId];

    // 处理Mermaid图表
    if (language === 'mermaid' || (!language && (code.includes('quadrantChart') || code.includes('graph') || code.includes('flowchart') || code.toLowerCase().includes('quadrant') || code.includes('sequenceDiagram') || code.includes('classDiagram')))) {
      return (
        <MermaidChart 
          code={code}
          title="Mermaid 图表"
          type="markdown"
          onCopy={(text) => copyToClipboard(text, codeId)}
        />
      );
    }

    // 处理其他代码块
    if (!inline && language) {
      const lines = code.split('\n').length;

      return (
        <div className="my-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
              <span className="text-sm font-medium text-slate-700 uppercase tracking-wide">
                {language}
              </span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                {lines} 行
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleCollapse(codeId)}
                className="h-8 px-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                {isCollapsed ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  try {
                    const ext = language ? `.${language}` : '.txt';
                    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `code${ext}`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('下载失败:', err);
                  }
                }}
                className="h-8 px-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                下载
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(code, codeId)}
                className="h-8 px-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                {isCopied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {!isCollapsed && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <SyntaxHighlighter
                style={oneLight}
                language={language}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  padding: '20px',
                  background: '#ffffff',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
                }}
              >
                {code}
              </SyntaxHighlighter>
            </div>
          )}
        </div>
      );
    }

    // 内联代码
    return (
      <code 
        className="px-2 py-1 bg-slate-100 text-slate-800 rounded text-sm font-mono border"
        {...props}
      >
        {children}
      </code>
    );
  };

  // 自定义组件
  const components = {
    code: CodeBlock,

    // 标题样式
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold text-slate-900 mb-6 pb-3 border-b border-slate-200">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-semibold text-slate-800 mb-4 mt-8">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-medium text-slate-700 mb-3 mt-6">
        {children}
      </h3>
    ),

    // 段落样式
    p: ({ children }) => (
      <p className="text-slate-700 leading-relaxed mb-4 whitespace-pre-wrap break-words">
        {children}
      </p>
    ),

    // 列表样式
    ul: ({ children }) => (
      <ul className="list-disc list-inside text-slate-700 mb-4 space-y-1 ml-4">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside text-slate-700 mb-4 space-y-1 ml-4">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-relaxed whitespace-pre-wrap break-words">
        {children}
      </li>
    ),

    // 引用样式
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-blue-200 bg-blue-50 pl-4 py-2 my-4 italic text-slate-700">
        {children}
      </blockquote>
    ),

    // 链接样式
    a: ({ href, children }) => (
      <a 
        href={href} 
        className="text-blue-600 hover:text-blue-800 underline decoration-blue-300 hover:decoration-blue-500 transition-colors"
        target="_blank" 
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),

    // 表格样式
    table: ({ children }) => (
      <div className="overflow-x-auto my-6">
        <table className="min-w-full border border-slate-200 rounded-lg overflow-hidden">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-slate-50">
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 border-b border-slate-200">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 text-sm text-slate-700 border-b border-slate-100">
        {children}
      </td>
    ),

    // 分割线
    hr: () => (
      <hr className="my-8 border-slate-200" />
    ),

    // 强调文本
    strong: ({ children }) => (
      <strong className="font-semibold text-slate-900">
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic text-slate-700">
        {children}
      </em>
    )
  };

  // 渲染结构化JSON内容
  const renderStructuredContent = useCallback((jsonData, blockIndex, isPartial = false) => {
    const renderValue = (key, value) => {
      // 检测Mermaid图表定义 - 分离显示
      if (typeof value === 'string' && /(classDiagram|sequenceDiagram|quadrantChart|graph|flowchart)/i.test(value)) {
        return (
          <MermaidChart 
            key={key}
            code={value}
            title={key}
            type="json"
            onCopy={(text) => copyToClipboard(text, `json-${blockIndex}-${key}`)}
          />
        );
      }

      // 数组 -> 列表
      if (Array.isArray(value)) {
        return (
          <div key={key} className="mb-4">
            <div className="text-sm font-medium text-slate-700 mb-2">{key}</div>
            <ul className="list-disc list-inside text-slate-700 ml-4 space-y-1">
              {value.map((v, i) => (
                <li key={i} className="text-sm leading-relaxed">
                  {Array.isArray(v) ? v.join(', ') : String(v)}
                </li>
              ))}
            </ul>
          </div>
        );
      }

      // 字符串
      if (typeof value === 'string') {
        return (
          <div key={key} className="mb-4">
            <div className="text-sm font-medium text-slate-700 mb-2">{key}</div>
            <div className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-3 rounded-lg">
              {value}
            </div>
          </div>
        );
      }

      // 其他对象
      return (
        <div key={key} className="mb-4">
          <div className="text-sm font-medium text-slate-700 mb-2">{key}</div>
          <pre className="bg-slate-50 p-3 rounded-lg text-sm overflow-auto text-slate-600">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      );
    };

    return (
      <div className="space-y-4">
        {Object.entries(jsonData).map(([k, v]) => renderValue(k, v))}
        {isPartial && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
            ⚠️ 部分内容正在加载中...
          </div>
        )}
      </div>
    );
  }, [copyToClipboard]);

  // 使用memo优化解析性能
  const { parsedContent, contentBlocks, partialContent } = useMemo(() => {
    return parseStreamingJSON(content);
  }, [content, parseStreamingJSON]);

  const parsedContentWithoutSuccess = useMemo(() => {
    if (!parsedContent) {
      return '';
    }
    return parsedContent
      .split(SUCCESS_LABEL)
      .join('')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }, [parsedContent]);

  const chatStreamingText = useMemo(() => {
    if (sessionMode !== 'chat') {
      return '';
    }
    if (!content) {
      return '';
    }
    return content.replace(/\r/g, '');
  }, [sessionMode, content]);

  const normalizeStreamingText = useCallback((text) => {
    if (!text) return '';
    const result = text.replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n');
    return result.replace(/[ \t]+\n/g, '\n');
  }, []);

  const thinkingText = useMemo(() => {
    if (typeof thinkingContent !== 'string') {
      return '';
    }
    return thinkingContent.trim();
  }, [thinkingContent]);

  const displayThinkingText = useMemo(() => normalizeStreamingText(thinkingText), [thinkingText, normalizeStreamingText]);
  const displayStatusLines = useMemo(() => {
    const normalized = (statusLines || [])
      .map(line => normalizeStreamingText(line))
      .filter(Boolean);
    const MAX_LINES = 12;
    return normalized.slice(-MAX_LINES);
  }, [statusLines, normalizeStreamingText]);

  const textualStreamingPieces = useMemo(() => {
    if (sessionMode === 'chat') {
      return [];
    }
    const pieces = [];
    if (parsedContentWithoutSuccess && parsedContentWithoutSuccess.trim()) {
      pieces.push(parsedContentWithoutSuccess.trim());
    }
    contentBlocks
      .filter(block => block.type === 'text' && (block.data || block.raw))
      .forEach(block => {
        const text = (block.data || block.raw || '').trim();
        if (text) {
          pieces.push(text);
        }
      });
    if (partialContent && partialContent.trim()) {
      pieces.push(partialContent.trim());
    }
    return pieces;
  }, [sessionMode, parsedContentWithoutSuccess, contentBlocks, partialContent]);

  const rawStreamingMarkdown = useMemo(() => {
    if (sessionMode === 'chat') {
      return chatStreamingText;
    }
    if (!textualStreamingPieces.length) {
      return '';
    }
    return textualStreamingPieces.join('\n\n');
  }, [isChatSession, chatStreamingText, textualStreamingPieces]);

  const sanitizedStreamingMarkdown = useMemo(() => {
    if (!rawStreamingMarkdown) {
      return '';
    }

    const ERROR_HEADERS = [/ollama\s+(http|decode)\s+error/i, /^❌/u, /^错误[:：]/i, /^\*\*错误\*\*/i];
    const ERROR_PAYLOAD_PATTERNS = [/^\s*[\[{]/, /"model":/i, /"role":/i, /"done":\s*false/i, /task_type/i];

    const lines = rawStreamingMarkdown.split(/\r?\n/);
    const result = [];
    let skippingErrorPayload = false;

    const pushLine = (value) => {
      if (!result.length || result[result.length - 1] !== value) {
        result.push(value);
      }
    };

    lines.forEach(rawLine => {
      const trimmed = rawLine.trim();
      const lower = trimmed.toLowerCase();

      if (!trimmed) {
        pushLine('');
        skippingErrorPayload = false;
        return;
      }

      if (lower.startsWith('意图判定') || lower.startsWith('intent') || lower.includes('intent:')) {
        return;
      }

      if (ERROR_HEADERS.some(pattern => pattern.test(trimmed))) {
        skippingErrorPayload = true;
        return;
      }

      if (skippingErrorPayload) {
        const looksLikePayload = ERROR_PAYLOAD_PATTERNS.some(pattern => pattern.test(trimmed)) || lower.includes('done":false');
        if (looksLikePayload) {
          return;
        }
        skippingErrorPayload = false;
      }

      const sanitizedLine = rawLine
        .replace(/\s*（详细信息已隐藏）/g, '')
        .replace(/\s*\(详细信息已隐藏\)/g, '');

      pushLine(sanitizedLine);
    });

    return result.join('\n');
  }, [rawStreamingMarkdown]);

  const hasSuccessIndicator = useMemo(() => {
    if (sessionMode === 'chat') {
      return false;
    }
    if (typeof content === 'string' && content.includes(SUCCESS_LABEL)) {
      return true;
    }
    if (sanitizedStreamingMarkdown && sanitizedStreamingMarkdown.includes(SUCCESS_LABEL)) {
      return true;
    }
    if (Array.isArray(statusLines) && statusLines.some(line => (line || '').includes(SUCCESS_LABEL))) {
      return true;
    }
    return false;
  }, [sessionMode, content, sanitizedStreamingMarkdown, statusLines]);

  const sanitizedLogs = useMemo(() => {
    if (!sanitizedStreamingMarkdown) {
      return '';
    }
    if (!hasSuccessIndicator) {
      return sanitizedStreamingMarkdown;
    }
    const cleaned = sanitizedStreamingMarkdown
      .split(SUCCESS_LABEL)
      .join('')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return cleaned;
  }, [sanitizedStreamingMarkdown, hasSuccessIndicator]);

  const { intentStatusLines, remainingStatusLines } = useMemo(() => {
    if (!displayStatusLines.length) {
      return { intentStatusLines: [], remainingStatusLines: [] };
    }

    const KEYWORDS = ['意图', 'intent', '闲聊模式', '闲聊', 'agent 任务', 'agent任务', '数据解释', 'chat', 'agent'];
    const ERROR_KEYWORDS = ['ollama http error', 'ollama decode error'];
    const ERROR_LINE_REGEXES = [/^❌/u, /^错误[:：]/i, /^\*\*错误\*\*/i];
    const ERROR_PAYLOAD_REGEXES = [/"model":/i, /"role":/i, /"done":\s*false/i, /task_type/i];
    const seen = new Set();
    const intents = [];
    const rest = [];
    let skippingErrorBlock = false;

    displayStatusLines.forEach(line => {
      const trimmed = (line || '').trim();
      if (!trimmed) {
        skippingErrorBlock = false;
        return;
      }
      const lower = trimmed.toLowerCase();
      const containsErrorKeyword = ERROR_KEYWORDS.some(pattern => lower.includes(pattern));
      const matchesErrorLine = containsErrorKeyword || ERROR_LINE_REGEXES.some(re => re.test(trimmed));

      if (matchesErrorLine) {
        skippingErrorBlock = true;
        return;
      }
      if (skippingErrorBlock) {
        const payloadLike = ERROR_PAYLOAD_REGEXES.some(re => re.test(trimmed)) || lower.startsWith('"') || lower.includes('done":false');
        if (payloadLike) {
          return;
        }
        skippingErrorBlock = false;
      }
      const matchesIntent = KEYWORDS.some(keyword => lower.includes(keyword.toLowerCase()));
      if (matchesIntent && !seen.has(trimmed)) {
        intents.push(trimmed);
        seen.add(trimmed);
      } else {
        rest.push(trimmed);
      }
    });

    const sanitizedLineSet = new Set();
    if (sanitizedLogs) {
      sanitizedLogs.split(/\r?\n/).forEach(rawLine => {
        const key = (rawLine || '').trim();
        if (key) {
          sanitizedLineSet.add(key);
        }
      });
    }
    const filteredRest = rest
      .filter(line => !sanitizedLineSet.has(line.trim()))
      .filter(line => !line.includes(SUCCESS_LABEL));

    return { intentStatusLines: intents, remainingStatusLines: filteredRest };
  }, [displayStatusLines, sanitizedLogs]);

  const metagptLogText = useMemo(() => {
    const sections = [];
    if (sanitizedLogs && sanitizedLogs.trim()) {
      sections.push(sanitizedLogs.trim());
    }
    if (remainingStatusLines.length) {
      sections.push(remainingStatusLines.join('\n'));
    }
    return sections.join('\n\n').trim();
  }, [sanitizedLogs, remainingStatusLines]);

  const showIntentPanel = useMemo(() => {
    if (intentStatusLines.length > 0) {
      return true;
    }
    return !isComplete;
  }, [intentStatusLines.length, isComplete]);

  // 代码块：仅从非 [CONTENT] 的 Markdown 中提取
  const codeBlocks = useMemo(() => extractCodeBlocks(parsedContent), [parsedContent, extractCodeBlocks]);
  const codesMarkdown = useMemo(
    () => codeBlocks.map(b => `\n\`\`\`${b.language}\n${b.code}\n\`\`\`\n`).join('\n'),
    [codeBlocks]
  );

  // 结构化块：来自 [CONTENT] 的 JSON（按块展示，避免混杂在 Thinking 文本里）
  const structuredBlocks = useMemo(() => contentBlocks.filter(b => b.type === 'json'), [contentBlocks]);
  const visibleStructuredBlocks = useMemo(() => {
    return isComplete ? structuredBlocks : [];
  }, [structuredBlocks, isComplete]);

  if (!content) {
    return null;
  }

  // 简洁模式：仅展示精简的文本（隐藏思维链和代码）
  if (compact) {
  const briefText = (displayThinkingText || thinkingText || sanitizedLogs || '').trim() || (visibleStructuredBlocks[0] ? JSON.stringify(visibleStructuredBlocks[0].data, null, 2) : '');
    return (
      <div className="flex justify-start mb-4">
  <div className="flex space-x-3 w-full max-w-3xl">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
            <div className="w-3.5 h-3.5 bg-white rounded-full opacity-90"></div>
          </div>
          <Card className="w-full p-4 bg-white border border-slate-100 shadow-sm">
            <pre className="text-sm text-slate-700 whitespace-pre-wrap m-0">
              {briefText}
            </pre>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
  <div className="flex space-x-3 w-full max-w-3xl">
        {/* Avatar 缩小 */}
        <div className="w-7 h-7 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
          <div className="w-3.5 h-3.5 bg-white rounded-full opacity-90"></div>
        </div>

        <div className="flex-1 min-w-0">
          {/* 消息头部（更收敛） */}
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-sm font-medium text-slate-700">AI 智能团队</span>
            {!isComplete && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-500">实时输出中</span>
              </div>
            )}
          </div>

          {/* 整体消息面板：保持单一 Card，不拆分 */}
          <Card className="w-full p-4 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="prose prose-slate max-w-none text-sm">
              {/* Thinking / Code 两区 */}
              <div className="space-y-4 text-sm">
                {/* Intent detection indicators */}
                {showIntentPanel && (
                  <div className="rounded-md border border-blue-100 bg-blue-50/80 p-3 shadow-inner">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 tracking-wide">
                        <Compass className="w-3.5 h-3.5" />
                        意图判定
                      </div>
                      {!isComplete && (
                        <span className="flex items-center gap-1 text-[10px] text-blue-500">
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                          实时更新
                        </span>
                      )}
                    </div>
                    {intentStatusLines.length > 0 ? (
                      <div className="space-y-1 text-xs text-blue-700 leading-relaxed">
                        {intentStatusLines.map((line, idx) => (
                          <div key={`intent-${idx}`} className="flex items-start gap-2">
                            <span className="mt-1 w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></span>
                            <span className="flex-1 break-words">{line}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-blue-600 leading-relaxed">AI 正在判定当前对话意图，请稍候...</div>
                    )}
                  </div>
                )}

                {/* Thinking 提升至上方 */}
                {(displayThinkingText || isThinkingActive) && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                        <span className="text-xs font-medium text-slate-700 tracking-wide flex items-center gap-1">
                          <span role="img" aria-label="thinking">🤔</span>
                          Thinking
                          {isThinkingActive && (
                            <span className="flex items-center gap-1 text-[10px] text-slate-500">
                              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                              正在推理...
                            </span>
                          )}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setThinkingCollapsed(!thinkingCollapsed)}
                        className="h-7 px-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                      >
                        {thinkingCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </Button>
                    </div>
                    {!thinkingCollapsed && (
                      <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                        {displayThinkingText ? (
                          <div className="text-xs text-slate-600 whitespace-normal break-words leading-relaxed">{displayThinkingText}</div>
                        ) : (
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-ping"></span>
                            AI 正在组织下一步思路...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Structured JSON blocks from [CONTENT] -> 美化展示 */}
                {visibleStructuredBlocks.length > 0 && (
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span className="text-xs font-medium text-slate-700 tracking-wide">🧠 思维链（结构化）</span>
                      <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full ml-2">{visibleStructuredBlocks.length} 段</span>
                        </div>
                    <div className="space-y-3">
                      {visibleStructuredBlocks.map((blk, i) => {
                        const jd = blk.data || {};
                        const hasPrd = jd["Project Name"] || jd["Original Requirements"] || jd["Product Goals"] || jd["User Stories"];
                        return (
                          <div key={i} className="bg-slate-50 border border-slate-100 rounded-md p-3">
                            {hasPrd ? (
                              <div className="space-y-2">
                                {jd["Project Name"] && (
                                  <div>
                                    <div className="text-xs font-semibold text-slate-700">项目名称</div>
                                    <div className="text-slate-700 text-sm">{jd["Project Name"]}</div>
                      </div>
                                )}
                                {jd["Original Requirements"] && (
                                  <div>
                                    <div className="text-xs font-semibold text-slate-700">原始需求</div>
                                    <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{jd["Original Requirements"]}</div>
                      </div>
                    )}
                                {Array.isArray(jd["Product Goals"]) && jd["Product Goals"].length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold text-slate-700">产品目标</div>
                                    <ul className="list-disc list-inside text-slate-700 text-sm ml-4 space-y-1">
                                      {jd["Product Goals"].map((g, idx) => (
                                        <li key={idx}>{g}</li>
                                      ))}
                                    </ul>
                  </div>
                                )}
                                {Array.isArray(jd["User Stories"]) && jd["User Stories"].length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold text-slate-700">用户故事</div>
                                    <ol className="list-decimal list-inside text-slate-700 text-sm ml-4 space-y-1">
                                      {jd["User Stories"].map((s, idx) => (
                                        <li key={idx}>{s}</li>
                ))}
                                    </ol>
                    </div>
                                )}
                                {/* 兜底：展示其余键值 */}
                                <div className="space-y-1">
                                  {Object.entries(jd).filter(([k]) => !["Project Name","Original Requirements","Product Goals","User Stories"].includes(k)).map(([k,v]) => (
                                    <div key={k} className="flex items-start gap-2">
                                      <div className="font-mono text-xs text-slate-500 w-36 truncate">{k}:</div>
                                      <div className="flex-1 text-sm text-slate-700 whitespace-pre-wrap">{typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}</div>
                    </div>
                                  ))}
                  </div>
                              </div>
                            ) : (
                              <pre className="text-xs text-slate-700 whitespace-pre-wrap m-0">{JSON.stringify(jd, null, 2)}</pre>
                )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Code: 仅渲染代码块并使用自定义CodeBlock以带复制 */}
                {codesMarkdown && codeBlocks.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span className="text-xs font-medium text-slate-700 tracking-wide">🛠️ Code</span>
                        <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full ml-2">{codeBlocks.length} 段</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCodeCollapsed(!codeCollapsed)}
                        className="h-7 px-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                      >
                        {codeCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </Button>
                    </div>
                    {!codeCollapsed && (
                  <div className="text-xs text-slate-700">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      skipHtml
                      components={components}
                    >
                          {codesMarkdown}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
                )}

                {/* MetaGPT 日志正文置底 */}
                {metagptLogText && (
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                      <span className="text-xs font-medium text-slate-700 tracking-wide">📜 MetaGPT 日志</span>
                      {!isComplete && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">实时更新</span>
                      )}
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 whitespace-pre-wrap break-words overflow-hidden">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        skipHtml
                        components={components}
                      >
                        {metagptLogText}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {hasSuccessIndicator && isComplete && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-emerald-700 shadow-inner">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium tracking-wide">{SUCCESS_LABEL}</span>
                    </div>
                  </div>
                )}
            </div>
            </div>

            {/* 流式输出指示器（置灰） */}
            {!isComplete && (
              <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-slate-100">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-slate-500">AI 团队正在协作处理中，请稍候...</span>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EnhancedStreamingMessage;
