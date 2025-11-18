import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FolderOpen, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Trash2,
  Calendar,
  Users,
  FileText,
  Code,
  Database,
  Image,
  Archive,
  ExternalLink,
  RefreshCw,
  Settings,
  MoreHorizontal
} from 'lucide-react';
import { metaGPTAPI } from '../services/api';

const ProjectManagerNew = () => {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);

  // 加载项目列表
  useEffect(() => {
    loadProjects();
  }, []);

  // 搜索和过滤
  useEffect(() => {
    filterProjects();
  }, [projects, searchTerm, statusFilter]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await metaGPTAPI.getProjects();
      setProjects(response.projects || []);
    } catch (error) {
      console.error('加载项目失败:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // 过滤项目
  const filterProjects = () => {
    let filtered = projects;

    // 按状态过滤
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter);
    }

    // 按搜索词过滤
    if (searchTerm) {
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredProjects(filtered);
  };

  // 获取状态颜色
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'planning': return 'bg-yellow-500';
      case 'on_hold': return 'bg-gray-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // 获取状态文本
  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'in_progress': return '进行中';
      case 'planning': return '规划中';
      case 'on_hold': return '暂停';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  };

  // 获取文件图标
  const getFileIcon = (type) => {
    switch (type) {
      case 'code': return Code;
      case 'document': return FileText;
      case 'database': return Database;
      case 'image': return Image;
      case 'archive': return Archive;
      default: return FileText;
    }
  };

  // 获取智能体名称
  const getAgentName = (agentId) => {
    const names = {
      'product_manager': '产品经理',
      'architect': '架构师',
      'engineer': '工程师',
      'qa_engineer': '测试工程师',
      'project_manager': '项目经理',
      'team_leader': '团队负责人'
    };
    return names[agentId] || agentId;
  };

  // 格式化日期
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  // 查看项目详情
  const viewProjectDetails = (project) => {
    setSelectedProject(project);
    setShowProjectDetails(true);
  };

  // 下载项目文件
  const downloadProjectFile = async (projectId, fileName) => {
    try {
      const blob = await metaGPTAPI.downloadProjectFile(projectId, fileName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载文件失败:', error);
      alert('下载文件失败，请稍后重试');
    }
  };

  // 删除项目
  const deleteProject = async (projectId) => {
    if (window.confirm('确定要删除这个项目吗？此操作不可恢复。')) {
      try {
        const response = await metaGPTAPI.deleteProject(projectId);
        if (response.success) {
          setProjects(prev => prev.filter(p => p.id !== projectId));
          alert('项目删除成功');
        } else {
          alert('删除项目失败: ' + response.message);
        }
      } catch (error) {
        console.error('删除项目失败:', error);
        alert('删除项目失败: ' + error.message);
      }
    }
  };

  if (showProjectDetails && selectedProject) {
    return (
      <div className="h-full flex flex-col">
        {/* 项目详情头部 */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setShowProjectDetails(false)}
              >
                ← 返回
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{selectedProject.name}</h1>
                <p className="text-muted-foreground">{selectedProject.description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className={`${getStatusColor(selectedProject.status)} text-white`}>
                {getStatusText(selectedProject.status)}
              </Badge>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                设置
              </Button>
            </div>
          </div>
        </div>

        {/* 项目详情内容 */}
        <div className="flex-1 p-6">
          <Tabs defaultValue="overview" className="h-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="files">文件</TabsTrigger>
              <TabsTrigger value="team">团队</TabsTrigger>
              <TabsTrigger value="activity">活动</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 项目统计 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">项目进度</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Progress value={selectedProject.progress} className="h-2" />
                      <div className="flex justify-between text-sm">
                        <span>{selectedProject.progress}% 完成</span>
                        <span className={`${getStatusColor(selectedProject.status)} text-white px-2 py-1 rounded text-xs`}>
                          {getStatusText(selectedProject.status)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">文件统计</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>总文件数</span>
                        <span>{selectedProject.stats.totalFiles}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>代码文件</span>
                        <span>{selectedProject.stats.codeFiles}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>文档文件</span>
                        <span>{selectedProject.stats.documentFiles}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>总大小</span>
                        <span>{selectedProject.stats.totalSize}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">项目信息</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>创建时间</span>
                        <span>{formatDate(selectedProject.createdAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>更新时间</span>
                        <span>{formatDate(selectedProject.updatedAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>团队成员</span>
                        <span>{selectedProject.agents.length} 人</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 标签 */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-sm">项目标签</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">项目文件</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedProject.files.map((file, index) => {
                      const Icon = getFileIcon(file.type);
                      return (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Icon className="w-5 h-5 text-blue-500" />
                            <div>
                              <p className="font-medium">{file.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {file.size} • 修改于 {formatDate(file.lastModified)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadProjectFile(selectedProject.id, file.name)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="team" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">团队成员</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedProject.agents.map((agent, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{getAgentName(agent)}</p>
                          <p className="text-sm text-muted-foreground">智能体角色</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">最近活动</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm">项目创建完成</p>
                        <p className="text-xs text-muted-foreground">{formatDate(selectedProject.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm">文件更新</p>
                        <p className="text-xs text-muted-foreground">{formatDate(selectedProject.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">项目管理</h1>
            <p className="text-muted-foreground">管理和跟踪您的MetaGPT项目</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={loadProjects}>
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              新建项目
            </Button>
          </div>
        </div>

        {/* 搜索和过滤 */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索项目..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center space-x-2">
            {[
              { key: 'all', label: '全部' },
              { key: 'completed', label: '已完成' },
              { key: 'in_progress', label: '进行中' },
              { key: 'planning', label: '规划中' }
            ].map(filter => (
              <Button
                key={filter.key}
                variant={statusFilter === filter.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(filter.key)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* 项目列表 */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">加载项目中...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchTerm ? '没有找到匹配的项目' : '暂无项目'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? '尝试调整搜索条件' : '开始创建您的第一个项目'}
              </p>
              {!searchTerm && (
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  新建项目
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer transition-all hover:shadow-lg"
                  onClick={() => viewProjectDetails(project)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{project.name}</CardTitle>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {project.description}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(project.id);
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* 进度条 */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">进度</span>
                        <span className="text-sm text-muted-foreground">{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} className="h-2" />
                    </div>

                    {/* 状态和标签 */}
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="outline" className={`${getStatusColor(project.status)} text-white`}>
                        {getStatusText(project.status)}
                      </Badge>
                      <div className="flex flex-wrap gap-1">
                        {project.tags.slice(0, 2).map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {project.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{project.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* 团队成员 */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {project.agents.length} 个智能体
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {project.files.length} 个文件
                        </span>
                      </div>
                    </div>

                    {/* 时间信息 */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>创建于 {formatDate(project.createdAt)}</span>
                      </div>
                      <span>更新于 {formatDate(project.updatedAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ProjectManagerNew;

