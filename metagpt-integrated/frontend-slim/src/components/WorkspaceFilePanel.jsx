import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  Download, 
  Archive, 
  Folder, 
  File, 
  FileCode, 
  FileText, 
  Image, 
  Video, 
  Music,
  ChevronRight,
  ChevronDown,
  Loader2
} from 'lucide-react';

const WorkspaceFilePanel = ({ isVisible, onClose }) => {
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [downloadingZip, setDownloadingZip] = useState(false);

  // 图标映射
  const getIcon = (iconType) => {
    const iconMap = {
      'folder': Folder,
      'file-code': FileCode,
      'file-text': FileText,
      'image': Image,
      'video': Video,
      'music': Music,
      'archive': Archive,
      'file': File
    };
    return iconMap[iconType] || File;
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 加载workspace文件
  const loadWorkspaceFiles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/workspace/files');
      const data = await response.json();
      
      console.log('Workspace API response:', data); // 调试日志
      
      if (data.success) {
        setFiles(data.files);
        setStats(data.stats);
      } else {
        console.error('加载文件失败:', data.error);
        setFiles([]);
        setStats({});
      }
    } catch (error) {
      console.error('加载文件失败:', error);
      setFiles([]);
      setStats({});
    } finally {
      setLoading(false);
    }
  };

  // 下载单个文件
  const downloadFile = async (filePath, fileName) => {
    try {
      const response = await fetch(`/api/workspace/download/${encodeURIComponent(filePath)}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errorData = await response.json();
        console.error('下载文件失败:', errorData.error);
      }
    } catch (error) {
      console.error('下载文件失败:', error);
    }
  };

  // 下载压缩包
  const downloadZip = async () => {
    setDownloadingZip(true);
    try {
      const response = await fetch('/api/workspace/download-zip');
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // 从响应头获取文件名，或使用默认名称
        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'workspace.zip';
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errorData = await response.json();
        console.error('下载压缩包失败:', errorData.error);
      }
    } catch (error) {
      console.error('下载压缩包失败:', error);
    } finally {
      setDownloadingZip(false);
    }
  };

  // 切换文件夹展开状态
  const toggleFolder = (folderPath) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  // 渲染文件树
  const renderFileTree = (items, level = 0) => {
    return items.map((item, index) => {
      const Icon = getIcon(item.icon);
      const isExpanded = expandedFolders.has(item.path);
      
      return (
        <div key={`${item.path}-${index}`} style={{ marginLeft: `${level * 16}px` }}>
          <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg group">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {item.type === 'folder' ? (
                <button
                  onClick={() => toggleFolder(item.path)}
                  className="flex items-center space-x-2 text-left flex-1 min-w-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                  <Icon className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium truncate">{item.name}</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <div className="w-4 h-4" /> {/* 占位符，保持对齐 */}
                  <Icon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm truncate">{item.name}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {item.type === 'file' && (
                <>
                  <span className="text-xs text-gray-500">{formatFileSize(item.size)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadFile(item.path, item.name)}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="下载文件"
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {/* 渲染子文件夹内容 */}
          {item.type === 'folder' && isExpanded && item.children && (
            <div className="ml-2">
              {renderFileTree(item.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  useEffect(() => {
    if (isVisible) {
      loadWorkspaceFiles();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl h-[80vh] mx-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Workspace 文件管理</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="flex flex-col h-full">
          {/* 统计信息和操作按钮 */}
          <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">
                {stats.total_files || 0} 个文件
              </Badge>
              <Badge variant="outline">
                {formatFileSize(stats.total_size || 0)}
              </Badge>
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadWorkspaceFiles}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                刷新
              </Button>
              <Button
                onClick={downloadZip}
                disabled={downloadingZip || !files.length}
                size="sm"
              >
                {downloadingZip ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Archive className="w-4 h-4 mr-2" />
                )}
                下载全部
              </Button>
            </div>
          </div>

          {/* 文件列表 */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span>加载中...</span>
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Folder className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Workspace 目录为空</p>
                  <p className="text-sm">生成的项目文件将显示在这里</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {renderFileTree(files)}
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkspaceFilePanel;

