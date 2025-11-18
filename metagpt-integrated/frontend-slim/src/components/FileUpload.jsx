import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  File, 
  X, 
  FileText, 
  FileCode, 
  FileImage,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';

const FileUpload = ({ onFileUpload, onFileRemove, maxFiles = 5, maxSize = 10 * 1024 * 1024 }) => {
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // 支持的文件类型
  const supportedTypes = {
    'text/plain': { icon: FileText, color: 'blue', name: 'TXT' },
    'text/markdown': { icon: FileText, color: 'blue', name: 'MD' },
    'application/pdf': { icon: FileText, color: 'red', name: 'PDF' },
    'application/msword': { icon: FileText, color: 'blue', name: 'DOC' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: FileText, color: 'blue', name: 'DOCX' },
    'text/csv': { icon: FileSpreadsheet, color: 'green', name: 'CSV' },
    'application/vnd.ms-excel': { icon: FileSpreadsheet, color: 'green', name: 'XLS' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: FileSpreadsheet, color: 'green', name: 'XLSX' },
    'application/json': { icon: FileCode, color: 'yellow', name: 'JSON' },
    'text/javascript': { icon: FileCode, color: 'yellow', name: 'JS' },
    'text/typescript': { icon: FileCode, color: 'blue', name: 'TS' },
    'text/html': { icon: FileCode, color: 'orange', name: 'HTML' },
    'text/css': { icon: FileCode, color: 'blue', name: 'CSS' },
    'application/python': { icon: FileCode, color: 'green', name: 'PY' },
    'image/jpeg': { icon: FileImage, color: 'purple', name: 'JPG' },
    'image/png': { icon: FileImage, color: 'purple', name: 'PNG' },
    'image/gif': { icon: FileImage, color: 'purple', name: 'GIF' },
    'image/svg+xml': { icon: FileImage, color: 'purple', name: 'SVG' }
  };

  // 获取文件图标和信息
  const getFileInfo = (file) => {
    const info = supportedTypes[file.type] || { icon: File, color: 'gray', name: 'FILE' };
    return info;
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 验证文件
  const validateFile = (file) => {
    const errors = [];
    
    // 检查文件大小
    if (file.size > maxSize) {
      errors.push(`文件大小超过限制 (${formatFileSize(maxSize)})`);
    }
    
    // 检查文件类型
    if (!supportedTypes[file.type]) {
      errors.push('不支持的文件类型');
    }
    
    return errors;
  };

  // 处理文件选择
  const handleFiles = async (fileList) => {
    const newFiles = Array.from(fileList);
    
    // 检查文件数量限制
    if (files.length + newFiles.length > maxFiles) {
      alert(`最多只能上传 ${maxFiles} 个文件`);
      return;
    }

    const validFiles = [];
    const invalidFiles = [];

    newFiles.forEach(file => {
      const errors = validateFile(file);
      if (errors.length === 0) {
        validFiles.push({
          id: Date.now() + Math.random(),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'pending', // pending, uploading, success, error
          progress: 0,
          errors: []
        });
      } else {
        invalidFiles.push({ file, errors });
      }
    });

    if (invalidFiles.length > 0) {
      const errorMessage = invalidFiles.map(({ file, errors }) => 
        `${file.name}: ${errors.join(', ')}`
      ).join('\n');
      alert(`以下文件无法上传:\n${errorMessage}`);
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      
      // 开始上传
      setUploading(true);
      for (const fileItem of validFiles) {
        await uploadFile(fileItem);
      }
      setUploading(false);
    }
  };

  // 上传单个文件
  const uploadFile = async (fileItem) => {
    try {
      // 更新状态为上传中
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id 
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      // 模拟上传进度
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id 
            ? { ...f, progress }
            : f
        ));
      }

      // 读取文件内容
      const content = await readFileContent(fileItem.file);
      
      // 更新状态为成功
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id 
          ? { ...f, status: 'success', progress: 100, content }
          : f
      ));

      // 通知父组件
      if (onFileUpload) {
        onFileUpload({
          ...fileItem,
          content,
          status: 'success'
        });
      }

    } catch (error) {
      console.error('文件上传失败:', error);
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id 
          ? { ...f, status: 'error', errors: [error.message] }
          : f
      ));
    }
  };

  // 读取文件内容
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          let content = e.target.result;
          
          // 根据文件类型处理内容
          if (file.type.startsWith('image/')) {
            // 图片文件返回 base64
            resolve({
              type: 'image',
              data: content,
              mimeType: file.type
            });
          } else if (file.type === 'application/json') {
            // JSON 文件解析
            const jsonData = JSON.parse(content);
            resolve({
              type: 'json',
              data: jsonData,
              raw: content
            });
          } else {
            // 文本文件
            resolve({
              type: 'text',
              data: content,
              mimeType: file.type
            });
          }
        } catch (error) {
          reject(new Error('文件解析失败: ' + error.message));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };

      // 根据文件类型选择读取方式
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  // 移除文件
  const removeFile = (fileId) => {
    const fileToRemove = files.find(f => f.id === fileId);
    setFiles(prev => prev.filter(f => f.id !== fileId));
    
    if (onFileRemove && fileToRemove) {
      onFileRemove(fileToRemove);
    }
  };

  // 拖拽处理
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // 点击上传
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* 上传区域 */}
      <Card 
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          dragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <CardContent className="flex flex-col items-center justify-center py-8 px-4">
          <Upload className={`w-12 h-12 mb-4 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-center">
            <p className="text-lg font-medium mb-2">
              {dragActive ? '释放文件以上传' : '点击或拖拽文件到此处'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              支持 TXT, MD, PDF, DOC, DOCX, CSV, XLS, XLSX, JSON, JS, TS, HTML, CSS, PY, 图片等格式
            </p>
            <p className="text-xs text-muted-foreground">
              最大文件大小: {formatFileSize(maxSize)} | 最多 {maxFiles} 个文件
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".txt,.md,.pdf,.doc,.docx,.csv,.xls,.xlsx,.json,.js,.ts,.html,.css,.py,.jpg,.jpeg,.png,.gif,.svg"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">已上传文件 ({files.length}/{maxFiles})</h4>
          {files.map((fileItem) => {
            const fileInfo = getFileInfo(fileItem.file);
            const Icon = fileInfo.icon;
            
            return (
              <Card key={fileItem.id} className="p-3">
                <div className="flex items-center space-x-3">
                  <Icon className={`w-8 h-8 text-${fileInfo.color}-500`} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{fileItem.name}</p>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {fileInfo.name}
                        </Badge>
                        {fileItem.status === 'success' && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {fileItem.status === 'error' && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        {fileItem.status === 'uploading' && (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(fileItem.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(fileItem.size)}
                      </p>
                      {fileItem.status === 'uploading' && (
                        <p className="text-xs text-muted-foreground">
                          {fileItem.progress}%
                        </p>
                      )}
                    </div>
                    
                    {fileItem.status === 'uploading' && (
                      <Progress value={fileItem.progress} className="mt-2 h-1" />
                    )}
                    
                    {fileItem.errors.length > 0 && (
                      <div className="mt-2">
                        {fileItem.errors.map((error, index) => (
                          <p key={index} className="text-xs text-red-500">
                            {error}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 上传状态 */}
      {uploading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">正在处理文件...</span>
        </div>
      )}
    </div>
  );
};

export default FileUpload;

