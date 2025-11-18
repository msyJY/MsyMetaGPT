import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  File, 
  Archive, 
  Folder,
  FileText,
  Code,
  Image,
  Database,
  Settings,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

const FileDownloadPanel = ({ sessionId, isVisible, onClose }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadingFiles, setDownloadingFiles] = useState(new Set());
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [filesInfo, setFilesInfo] = useState(null);

  // 获取文件图标
  const getFileIcon = (fileType) => {
    const iconMap = {
      'python': Code,
      'javascript': Code,
      'html': Code,
      'css': Code,
      'markdown': FileText,
      'text': FileText,
      'json': Database,
      'yaml': Settings,
      'xml': Settings,
      'sql': Database,
      'shell': Settings,
      'batch': Settings,
      'docker': Settings,
      'git': Settings,
      'env': Settings,
      'log': FileText,
      'image': Image
    };
    return iconMap[fileType] || File;
  };

  // 获取文件类型颜色
  const getFileTypeColor = (fileType) => {
    const colorMap = {
      'python': 'bg-blue-100 text-blue-800',
      'javascript': 'bg-yellow-100 text-yellow-800',
      'html': 'bg-orange-100 text-orange-800',
      'css': 'bg-purple-100 text-purple-800',
      'markdown': 'bg-gray-100 text-gray-800',
      'text': 'bg-gray-100 text-gray-800',
      'json': 'bg-green-100 text-green-800',
      'yaml': 'bg-indigo-100 text-indigo-800',
      'xml': 'bg-red-100 text-red-800',
      'sql': 'bg-cyan-100 text-cyan-800',
      'shell': 'bg-slate-100 text-slate-800',
      'batch': 'bg-slate-100 text-slate-800',
      'docker': 'bg-blue-100 text-blue-800',
      'git': 'bg-orange-100 text-orange-800',
      'env': 'bg-green-100 text-green-800',
      'log': 'bg-yellow-100 text-yellow-800'
    };
    return colorMap[fileType] || 'bg-gray-100 text-gray-800';
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 加载文件列表
  const loadFiles = async () => {
    if (!sessionId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/files/list/${sessionId}`);
      const data = await response.json();
      
      if (data.success) {
        setFiles(data.files);
        
        // 同时获取文件统计信息
        const infoResponse = await fetch(`/api/files/info/${sessionId}`);
        const infoData = await infoResponse.json();
        if (infoData.success) {
          setFilesInfo(infoData);
        }
      } else {
        setError(data.error || '加载文件列表失败');
      }
    } catch (err) {
      setError('网络错误：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 下载单个文件
  const downloadFile = async (file) => {
    setDownloadingFiles(prev => new Set([...prev, file.path]));
    
    try {
      const response = await fetch(`/api/files/download/${sessionId}/${file.path}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '下载失败');
      }
    } catch (err) {
      setError('下载文件失败：' + err.message);
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.path);
        return newSet;
      });
    }
  };

  // 下载压缩包
  const downloadZip = async () => {
    setDownloadingZip(true);
    
    try {
      const response = await fetch(`/api/files/download-zip/${sessionId}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // 从响应头获取文件名，或使用默认名称
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `generated_files_${sessionId.slice(0, 8)}_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.zip`;
        
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
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
        throw new Error(errorData.error || '下载压缩包失败');
      }
    } catch (err) {
      setError('下载压缩包失败：' + err.message);
    } finally {
      setDownloadingZip(false);
    }
  };

  // 组件挂载时加载文件
  useEffect(() => {
    if (isVisible && sessionId) {
      loadFiles();
    }
  }, [isVisible, sessionId]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl h-[80vh] bg-white shadow-xl">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Folder className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">生成的文件</h2>
              <p className="text-sm text-gray-500">会话 ID: {sessionId?.slice(0, 8)}...</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadFiles}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>

        {/* 统计信息 */}
        {filesInfo && (
          <div className="p-4 bg-gray-50 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <File className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {filesInfo.total_files} 个文件
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Archive className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    总大小: {formatFileSize(filesInfo.total_size)}
                  </span>
                </div>
              </div>
              <Button
                onClick={downloadZip}
                disabled={downloadingZip || files.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {downloadingZip ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Archive className="w-4 h-4 mr-2" />
                )}
                下载全部 (ZIP)
              </Button>
            </div>
          </div>
        )}

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-gray-500">加载文件列表...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                <p className="text-red-600 mb-4">{error}</p>
                <Button variant="outline" onClick={loadFiles}>
                  重试
                </Button>
              </div>
            </div>
          ) : files.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <File className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500">暂无生成的文件</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-4">
                <div className="grid gap-3">
                  {files.map((file, index) => {
                    const FileIcon = getFileIcon(file.type);
                    const isDownloading = downloadingFiles.has(file.path);
                    
                    return (
                      <Card key={index} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <FileIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className="font-medium text-gray-900 truncate">
                                  {file.name}
                                </h3>
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${getFileTypeColor(file.type)}`}
                                >
                                  {file.type}
                                </Badge>
                              </div>
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>{formatFileSize(file.size)}</span>
                                <span>{new Date(file.modified).toLocaleString()}</span>
                                <span className="truncate">{file.path}</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadFile(file)}
                            disabled={isDownloading}
                            className="ml-3 flex-shrink-0"
                          >
                            {isDownloading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </Card>
    </div>
  );
};

export default FileDownloadPanel;

