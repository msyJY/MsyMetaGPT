import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Terminal, 
  Info, 
  AlertTriangle, 
  XCircle, 
  CheckCircle,
  Bug,
  Search,
  Filter,
  Download,
  Trash2,
  Clock
} from 'lucide-react';

const LogViewer = ({ logs = [], title = "执行日志" }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [isExpanded, setIsExpanded] = useState(false);

  // 解析日志级别和内容
  const parseLogEntry = (log) => {
    const content = log.content || log;
    let level = 'info';
    let timestamp = '';
    let message = content;

    // 检测日志级别
    if (content.includes('ERROR') || content.includes('Exception') || content.includes('Traceback')) {
      level = 'error';
    } else if (content.includes('WARNING') || content.includes('WARN')) {
      level = 'warning';
    } else if (content.includes('DEBUG')) {
      level = 'debug';
    } else if (content.includes('SUCCESS') || content.includes('completed')) {
      level = 'success';
    }

    // 提取时间戳
    const timeMatch = content.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
    if (timeMatch) {
      timestamp = timeMatch[1];
      message = content.replace(timeMatch[0], '').trim();
    } else {
      // 尝试其他时间格式
      const simpleTimeMatch = content.match(/(\d{2}:\d{2}:\d{2})/);
      if (simpleTimeMatch) {
        timestamp = simpleTimeMatch[1];
        message = content.replace(simpleTimeMatch[0], '').trim();
      }
    }

    // 清理消息内容
    message = message.replace(/^\|\s*/, '').replace(/^(INFO|ERROR|WARNING|DEBUG|SUCCESS)\s*\|\s*/, '').trim();

    return {
      level,
      timestamp,
      message,
      original: content,
      line: log.line || 0
    };
  };

  // 获取日志级别样式
  const getLevelStyle = (level) => {
    const styles = {
      error: {
        icon: XCircle,
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      },
      warning: {
        icon: AlertTriangle,
        color: 'text-yellow-600 dark:text-yellow-400',
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-800',
        badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
      },
      success: {
        icon: CheckCircle,
        color: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-800',
        badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      },
      debug: {
        icon: Bug,
        color: 'text-gray-600 dark:text-gray-400',
        bg: 'bg-gray-50 dark:bg-gray-900/20',
        border: 'border-gray-200 dark:border-gray-700',
        badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      },
      info: {
        icon: Info,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      }
    };
    return styles[level] || styles.info;
  };

  // 处理和过滤日志
  const processedLogs = useMemo(() => {
    return logs.map(parseLogEntry);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return processedLogs.filter(log => {
      const matchesSearch = !searchTerm || 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.timestamp.includes(searchTerm);
      
      const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
      
      return matchesSearch && matchesLevel;
    });
  }, [processedLogs, searchTerm, levelFilter]);

  // 统计信息
  const stats = useMemo(() => {
    const counts = processedLogs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {});
    
    return {
      total: processedLogs.length,
      error: counts.error || 0,
      warning: counts.warning || 0,
      success: counts.success || 0,
      debug: counts.debug || 0,
      info: counts.info || 0
    };
  }, [processedLogs]);

  // 下载日志
  const downloadLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 清空搜索和过滤
  const clearFilters = () => {
    setSearchTerm('');
    setLevelFilter('all');
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {filteredLogs.length} / {stats.total}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadLogs}
              className="h-7 px-2"
              title="下载日志"
            >
              <Download className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="h-7 px-2"
              title="清空过滤"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {/* 统计信息 */}
        <div className="flex items-center gap-2 mt-2">
          {stats.error > 0 && (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs">
              错误 {stats.error}
            </Badge>
          )}
          {stats.warning > 0 && (
            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs">
              警告 {stats.warning}
            </Badge>
          )}
          {stats.success > 0 && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs">
              成功 {stats.success}
            </Badge>
          )}
          {stats.info > 0 && (
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
              信息 {stats.info}
            </Badge>
          )}
          {stats.debug > 0 && (
            <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-xs">
              调试 {stats.debug}
            </Badge>
          )}
        </div>
        
        {/* 搜索和过滤 */}
        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="h-3 w-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="搜索日志内容..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-7 text-xs"
            />
          </div>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-24 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="error">错误</SelectItem>
              <SelectItem value="warning">警告</SelectItem>
              <SelectItem value="success">成功</SelectItem>
              <SelectItem value="info">信息</SelectItem>
              <SelectItem value="debug">调试</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className={`space-y-2 overflow-auto ${isExpanded ? 'max-h-none' : 'max-h-80'}`}>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">没有找到匹配的日志</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const style = getLevelStyle(log.level);
              const Icon = style.icon;
              
              return (
                <div
                  key={index}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg border
                    ${style.bg} ${style.border}
                    hover:shadow-sm transition-shadow
                  `}
                >
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${style.color}`} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {log.timestamp && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {log.timestamp}
                        </div>
                      )}
                      <Badge className={`text-xs ${style.badge}`}>
                        {log.level.toUpperCase()}
                      </Badge>
                      {log.line > 0 && (
                        <Badge variant="outline" className="text-xs">
                          行 {log.line}
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm leading-relaxed break-words">
                      {log.message}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {filteredLogs.length > 5 && (
          <div className="flex justify-center mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 px-3 text-xs"
            >
              {isExpanded ? '收起日志' : `展开全部 (${filteredLogs.length} 条)`}
            </Button>
          </div>
        )}
        
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>实时日志监控</span>
          <span>💾 下载 • 🔍 搜索 • 🏷️ 过滤</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default LogViewer;

