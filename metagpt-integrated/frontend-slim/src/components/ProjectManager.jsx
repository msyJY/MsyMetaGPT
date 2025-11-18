import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FolderOpen, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Download,
  FileText,
  Code,
  Database,
  Globe,
  Play,
  Pause,
  Square
} from 'lucide-react';

const ProjectManager = () => {
  const [projects, setProjects] = useState([
    {
      id: 1,
      name: '2048游戏',
      description: '基于React的2048游戏项目',
      status: 'completed',
      progress: 100,
      createdAt: '2024-01-15',
      agents: ['product_manager', 'architect', 'engineer'],
      files: [
        { name: 'requirements.md', type: 'document', size: '12KB' },
        { name: 'architecture.md', type: 'document', size: '8KB' },
        { name: 'game.js', type: 'code', size: '15KB' },
        { name: 'styles.css', type: 'code', size: '5KB' }
      ]
    },
    {
      id: 2,
      name: '在线购物商城',
      description: '电商平台系统开发',
      status: 'in_progress',
      progress: 65,
      createdAt: '2024-01-20',
      agents: ['product_manager', 'architect', 'engineer', 'qa_engineer'],
      files: [
        { name: 'user_stories.md', type: 'document', size: '25KB' },
        { name: 'api_design.md', type: 'document', size: '18KB' },
        { name: 'database_schema.sql', type: 'database', size: '10KB' }
      ]
    },
    {
      id: 3,
      name: '用户管理系统',
      description: '企业级用户权限管理系统',
      status: 'planning',
      progress: 20,
      createdAt: '2024-01-22',
      agents: ['product_manager', 'architect'],
      files: [
        { name: 'requirements_analysis.md', type: 'document', size: '8KB' }
      ]
    }
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'planning': return 'bg-yellow-500';
      case 'paused': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'in_progress': return '进行中';
      case 'planning': return '规划中';
      case 'paused': return '已暂停';
      default: return '未知';
    }
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'document': return FileText;
      case 'code': return Code;
      case 'database': return Database;
      case 'web': return Globe;
      default: return FileText;
    }
  };

  const getAgentName = (agentId) => {
    const agentNames = {
      'product_manager': '产品经理',
      'architect': '架构师',
      'engineer': '工程师',
      'qa_engineer': '测试工程师',
      'project_manager': '项目经理',
      'team_leader': '团队负责人'
    };
    return agentNames[agentId] || agentId;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">项目管理</h2>
        <p className="text-muted-foreground">
          管理和查看所有MetaGPT生成的项目
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">全部项目</TabsTrigger>
          <TabsTrigger value="in_progress">进行中</TabsTrigger>
          <TabsTrigger value="completed">已完成</TabsTrigger>
          <TabsTrigger value="planning">规划中</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <FolderOpen className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`${getStatusColor(project.status)} text-white`}
                    >
                      {getStatusText(project.status)}
                    </Badge>
                  </div>
                  <CardDescription>{project.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* 进度条 */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>项目进度</span>
                      <span>{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                  </div>

                  {/* 参与的智能体 */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">参与角色</h4>
                    <div className="flex flex-wrap gap-1">
                      {project.agents.map((agentId) => (
                        <Badge key={agentId} variant="outline" className="text-xs">
                          {getAgentName(agentId)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* 文件列表 */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">项目文件 ({project.files.length})</h4>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {project.files.slice(0, 3).map((file, index) => {
                        const FileIcon = getFileIcon(file.type);
                        return (
                          <div key={index} className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                              <FileIcon className="w-3 h-3 text-muted-foreground" />
                              <span className="truncate">{file.name}</span>
                            </div>
                            <span className="text-muted-foreground">{file.size}</span>
                          </div>
                        );
                      })}
                      {project.files.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{project.files.length - 3} 个文件
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex space-x-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      <FolderOpen className="w-3 h-3 mr-1" />
                      查看
                    </Button>
                    <Button size="sm" variant="outline">
                      <Download className="w-3 h-3" />
                    </Button>
                    {project.status === 'in_progress' && (
                      <Button size="sm" variant="outline">
                        <Pause className="w-3 h-3" />
                      </Button>
                    )}
                    {project.status === 'paused' && (
                      <Button size="sm" variant="outline">
                        <Play className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  {/* 创建时间 */}
                  <div className="flex items-center text-xs text-muted-foreground pt-2 border-t">
                    <Clock className="w-3 h-3 mr-1" />
                    创建于 {project.createdAt}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="in_progress">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.filter(p => p.status === 'in_progress').map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                {/* 项目卡片内容 - 与上面相同的结构 */}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="completed">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.filter(p => p.status === 'completed').map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                {/* 项目卡片内容 - 与上面相同的结构 */}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="planning">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.filter(p => p.status === 'planning').map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                {/* 项目卡片内容 - 与上面相同的结构 */}
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectManager;

