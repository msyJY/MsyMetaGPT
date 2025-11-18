import React from 'react';
import TaskFlowViewer from './TaskFlowViewer';
import EnhancedCodeBlock from './EnhancedCodeBlock';
import LogViewer from './LogViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Code, 
  Info
} from 'lucide-react';

const ContentParser = ({ content, isStreaming = false, compact = false }) => {
  // helper: push section with basic dedupe and empty check
  const pushSection = (sections, sec) => {
    if (!sec) return;
    // ignore empty non-code, non-log, non-json sections
    const isEmpty = ((sec.content || '').trim() === '') && !sec.parsed && sec.type !== 'code' && sec.type !== 'log';
    if (isEmpty) return;
    const last = sections[sections.length - 1];
    if (last) {
      // compare serialized parsed/content for simple dedupe
      const lastContent = last.parsed ? JSON.stringify(last.parsed) : (last.content || '');
      const thisContent = sec.parsed ? JSON.stringify(sec.parsed) : (sec.content || '');
      if (last.type === sec.type && lastContent === thisContent) return;
    }
    sections.push(sec);
  };

  // 解析内容类型和数据
  const parseContent = (text) => {
    if (!text || typeof text !== 'string') {
      return { type: 'text', data: text || '', sections: [] };
    }

    const normalizedText = text.replace(/\r\n/g, '\n');

    const sections = [];
    const lines = normalizedText.split('\n');
    let currentSection = { type: 'text', content: '', startLine: 0 };
    let inCodeBlock = false;
    let codeLanguage = '';
    let jsonBuffer = '';
    let logBuffer = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 检测代码块开始
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // 代码块结束
          pushSection(sections, {
            type: 'code',
            language: codeLanguage,
            content: currentSection.content,
            startLine: currentSection.startLine,
            endLine: i
          });
          currentSection = { type: 'text', content: '', startLine: i + 1 };
          inCodeBlock = false;
          codeLanguage = '';
        } else {
          // 代码块开始
          if (currentSection.content.trim()) {
            pushSection(sections, {
              type: 'text',
              content: currentSection.content,
              startLine: currentSection.startLine,
              endLine: i - 1
            });
          }
          codeLanguage = line.replace('```', '').trim();
          currentSection = { type: 'code', content: '', startLine: i + 1 };
          inCodeBlock = true;
        }
        continue;
      }

      // 检测日志行
      if (line.includes('[BACKEND-OUT]') || line.includes('[BACKEND-ERR]')) {
        if (currentSection.type !== 'log') {
          if (currentSection.content.trim()) {
            pushSection(sections, {
              type: currentSection.type,
              content: currentSection.content,
              startLine: currentSection.startLine,
              endLine: i - 1
            });
          }
          currentSection = { type: 'log', content: '', startLine: i };
        }

        const logType = line.includes('[BACKEND-ERR]') ? 'error' : 'info';
        const logContent = line.replace(/\[BACKEND-(OUT|ERR)\]\s*/, '');
        logBuffer.push({ type: logType, content: logContent, line: i });
        continue;
      }

      // 检测JSON数据（含 [CONTENT] 包裹的情况，先去除标签）
      const stripped = line.replace(/^\[CONTENT\]\s*/i, '').replace(/\s*\[\/CONTENT\]$/i, '');
      if (stripped.trim().startsWith('{') || stripped.trim().startsWith('[')) {
        jsonBuffer = stripped || line;
        let braceCount = (line.match(/[{[]/g) || []).length - (line.match(/[}\]]/g) || []).length;

        // 尝试解析多行JSON
        for (let j = i + 1; j < lines.length && braceCount > 0; j++) {
          const nextStripped = lines[j].replace(/^\[CONTENT\]\s*/i, '').replace(/\s*\[\/CONTENT\]$/i, '');
          jsonBuffer += '\n' + (nextStripped || lines[j]);
          braceCount += (lines[j].match(/[{[]/g) || []).length - (lines[j].match(/[}\]]/g) || []).length;
          if (braceCount === 0) {
            try {
              const parsed = JSON.parse(jsonBuffer);
              pushSection(sections, {
                type: 'json',
                content: jsonBuffer,
                parsed: parsed,
                startLine: i,
                endLine: j
              });
              i = j; // 跳过已处理的行
              currentSection = { type: 'text', content: '', startLine: j + 1 };
              jsonBuffer = '';
              break;
            } catch (e) {
              // 不是有效JSON，继续作为普通文本处理
              break;
            }
          }
        }

        if (jsonBuffer && braceCount > 0) {
          // JSON不完整，作为普通文本处理
          currentSection.content += line + '\n';
          jsonBuffer = '';
        }
        continue;
      }

      // 普通文本行
      currentSection.content += line + '\n';
    }

    if (currentSection.content.trim()) {
      pushSection(sections, {
        type: currentSection.type,
        content: currentSection.content,
        startLine: currentSection.startLine,
        endLine: lines.length - 1
      });
    }

    // 处理日志缓冲区
    if (logBuffer.length > 0) {
      const logSection = sections.find(s => s.type === 'log');
      if (logSection) {
        // 避免重复赋值内容相同的 logs
        const existing = logSection.logs || [];
        const existingStr = JSON.stringify(existing);
        const newStr = JSON.stringify(logBuffer);
        if (existingStr !== newStr) {
          logSection.logs = logBuffer;
        }
      } else {
        // 若未被识别成单独 log 段，则创建一个新的 log section
        pushSection(sections, { type: 'log', content: '', startLine: 0, endLine: lines.length - 1, logs: logBuffer });
      }
    }

    return { type: 'mixed', data: text, sections };
  };

  const { sections: parsedSections } = parseContent(content);

  // 全局去重：按 type + 行号 + 内容/parsed 序列化来判重，保留首次出现
  const dedupeSections = (secs) => {
    const seen = new Set();
    return secs.filter(s => {
      const baseContent = s.parsed ? JSON.stringify(s.parsed) : (s.content || '');
      const key = s.type === 'text'
        ? `${s.type}::${baseContent}`
        : `${s.type}::${s.startLine ?? ''}::${s.endLine ?? ''}::${baseContent}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const sections = dedupeSections(parsedSections);

  // 检测任务流程数据
  const detectTaskFlow = (jsonData) => {
    if (Array.isArray(jsonData)) {
      return jsonData.every(item => 
        item.task_id && 
        item.instruction && 
        Array.isArray(item.dependent_task_ids)
      );
    }
    return false;
  };

  // 新增：简单的 key:value JSON 展示（递归、不折叠）
  const renderJsonInline = (data, depth = 0) => {
    const indent = { marginLeft: depth * 12 };
    if (data === null) {
      return <span className="text-sm text-gray-600">null</span>;
    }
    if (typeof data !== 'object') {
      return <span className="text-sm text-gray-700">{String(data)}</span>;
    }
    if (Array.isArray(data)) {
      return (
        <div style={indent} className="space-y-1">
          {data.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="text-xs text-gray-500 w-8">[{idx}]</div>
              <div className="flex-1">{renderJsonInline(item, depth + 1)}</div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={indent} className="space-y-1">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex items-start gap-2">
            <div className="font-mono text-xs text-gray-600 w-32 truncate">{k}:</div>
            <div className="flex-1">{renderJsonInline(v, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  };

  // 渲染单个 section（code 保留 title，其它只输出结构化内容）
  const renderSection = (section, index) => {
    const sectionKey = `section-${index}`;
    const commonHeader = (icon, title, extra) => (
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        {extra && <div>{extra}</div>}
      </div>
    );

    switch (section.type) {
      case 'json': {
        const isTaskFlow = detectTaskFlow(section.parsed);
        return (
          <div key={sectionKey} className="mb-3 pl-6">
            {isTaskFlow ? (
              <TaskFlowViewer tasks={section.parsed} />
            ) : (
              <div className="text-sm text-gray-800">
                {renderJsonInline(section.parsed)}
              </div>
            )}
          </div>
        );
      }

      case 'code':
        return (
          <div key={sectionKey} className="mb-4">
            {commonHeader(<Code className="h-4 w-4 text-violet-500" />, `代码 (${section.language || 'plain'})`, <Badge variant="outline">code · {section.startLine}</Badge>)}
            <div className="pl-6">
              <EnhancedCodeBlock 
                code={section.content}
                language={section.language}
                startLine={section.startLine}
              />
            </div>
          </div>
        );

      case 'log':
        return (
          <div key={sectionKey} className="mb-3 pl-6">
            <div className="text-sm text-gray-800">
              <LogViewer logs={section.logs || []} />
            </div>
          </div>
        );

      case 'text': {
        const trimmed = section.content.trim();
        if (!trimmed) return null;
        return (
          <div key={sectionKey} className="mb-3 pl-6">
            <pre className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {trimmed}
            </pre>
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (!content) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500">
        <Info className="h-5 w-5 mr-2" />
        暂无内容
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {content}
            </pre>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 将所有 section 串成一页展示（单个 Card）
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">解析结果</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">text</Badge>
            <Badge variant="outline">json</Badge>
            <Badge variant="outline">code</Badge>
            <Badge variant="outline">log</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sections.map((section, index) => renderSection(section, index))}
          {isStreaming && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full"></div>
              正在生成内容...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ContentParser;

