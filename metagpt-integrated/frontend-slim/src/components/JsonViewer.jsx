import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Search,
  Database,
  Hash,
  Type,
  ToggleLeft,
  List,
  Braces,
  Check
} from 'lucide-react';

const JsonViewer = ({ data, title = "JSON数据" }) => {
  const [expandedPaths, setExpandedPaths] = useState(new Set(['root']));
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedPath, setCopiedPath] = useState(null);

  // 获取数据类型图标
  const getTypeIcon = (value) => {
    if (value === null) return <span className="text-gray-400">null</span>;
    if (typeof value === 'string') return <Type className="h-3 w-3 text-green-600" />;
    if (typeof value === 'number') return <Hash className="h-3 w-3 text-blue-600" />;
    if (typeof value === 'boolean') return <ToggleLeft className="h-3 w-3 text-purple-600" />;
    if (Array.isArray(value)) return <List className="h-3 w-3 text-orange-600" />;
    if (typeof value === 'object') return <Braces className="h-3 w-3 text-red-600" />;
    return null;
  };

  // 获取数据类型颜色
  const getTypeColor = (value) => {
    if (value === null) return 'text-gray-400';
    if (typeof value === 'string') return 'text-green-600';
    if (typeof value === 'number') return 'text-blue-600';
    if (typeof value === 'boolean') return 'text-purple-600';
    return 'text-gray-700 dark:text-gray-300';
  };

  // 获取值的显示文本
  const getValueDisplay = (value) => {
    if (value === null) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    return '';
  };

  // 切换展开状态
  const toggleExpanded = (path) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  // 复制值到剪贴板
  const copyValue = async (value, path) => {
    try {
      const textToCopy = typeof value === 'object' 
        ? JSON.stringify(value, null, 2)
        : String(value);
      await navigator.clipboard.writeText(textToCopy);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 搜索匹配
  const isSearchMatch = (key, value, searchTerm) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const keyMatch = key.toLowerCase().includes(term);
    const valueMatch = String(value).toLowerCase().includes(term);
    return keyMatch || valueMatch;
  };

  // 渲染JSON节点
  const renderJsonNode = (value, key, path = 'root', level = 0) => {
    const isExpanded = expandedPaths.has(path);
    const hasChildren = (Array.isArray(value) && value.length > 0) || 
                       (typeof value === 'object' && value !== null && Object.keys(value).length > 0);
    
    // 搜索过滤
    if (searchTerm && !isSearchMatch(key, value, searchTerm)) {
      // 检查子节点是否有匹配
      if (hasChildren) {
        const hasMatchingChild = typeof value === 'object' && value !== null &&
          Object.entries(value).some(([childKey, childValue]) => 
            isSearchMatch(childKey, childValue, searchTerm)
          );
        if (!hasMatchingChild) return null;
      } else {
        return null;
      }
    }

    const indentLevel = level * 20;

    return (
      <div key={path} className="select-none">
        <div 
          className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded group"
          style={{ paddingLeft: `${indentLevel + 8}px` }}
        >
          {/* 展开/折叠按钮 */}
          {hasChildren && (
            <button
              onClick={() => toggleExpanded(path)}
              className="flex items-center justify-center w-4 h-4 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
          
          {/* 类型图标 */}
          <div className="flex items-center gap-1">
            {getTypeIcon(value)}
          </div>

          {/* 键名 */}
          {key !== 'root' && (
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {key}:
            </span>
          )}

          {/* 值或类型信息 */}
          {!hasChildren ? (
            <span className={`${getTypeColor(value)} font-mono text-sm`}>
              {getValueDisplay(value)}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {Array.isArray(value) 
                  ? `Array (${value.length})`
                  : `Object (${Object.keys(value).length})`
                }
              </Badge>
            </div>
          )}

          {/* 复制按钮 */}
          <button
            onClick={() => copyValue(value, path)}
            className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
          >
            {copiedPath === path ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-gray-400 hover:text-gray-600" />
            )}
          </button>
        </div>

        {/* 子节点 */}
        {hasChildren && isExpanded && (
          <div className="border-l border-gray-200 dark:border-gray-700 ml-2">
            {Array.isArray(value) ? (
              value.map((item, index) => 
                renderJsonNode(item, `[${index}]`, `${path}.${index}`, level + 1)
              )
            ) : (
              Object.entries(value).map(([childKey, childValue]) =>
                renderJsonNode(childValue, childKey, `${path}.${childKey}`, level + 1)
              )
            )}
          </div>
        )}
      </div>
    );
  };

  // 计算统计信息
  const stats = useMemo(() => {
    const countNodes = (obj) => {
      let count = 0;
      if (Array.isArray(obj)) {
        count += obj.length;
        obj.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            count += countNodes(item);
          }
        });
      } else if (typeof obj === 'object' && obj !== null) {
        const keys = Object.keys(obj);
        count += keys.length;
        keys.forEach(key => {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            count += countNodes(obj[key]);
          }
        });
      }
      return count;
    };

    return {
      totalNodes: countNodes(data),
      type: Array.isArray(data) ? 'Array' : 'Object',
      size: Array.isArray(data) ? data.length : Object.keys(data || {}).length
    };
  }, [data]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {stats.type} ({stats.size})
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3 w-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="搜索字段..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 h-7 w-40 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyValue(data, 'root')}
              className="h-7 px-2"
            >
              {copiedPath === 'root' ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="max-h-96 overflow-auto border rounded-md bg-gray-50 dark:bg-gray-900">
          {renderJsonNode(data, 'root')}
        </div>
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>总计 {stats.totalNodes} 个节点</span>
          <span>点击 📋 复制数据</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default JsonViewer;

