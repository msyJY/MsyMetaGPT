import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  GitBranch, 
  Play, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  ArrowRight,
  Maximize2,
  Minimize2
} from 'lucide-react';

const TaskFlowViewer = ({ tasks = [], title = "任务流程" }) => {
  const [selectedTask, setSelectedTask] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // 构建任务依赖图
  const taskGraph = useMemo(() => {
    const taskMap = new Map();
    const dependencyMap = new Map();
    
    // 创建任务映射
    tasks.forEach(task => {
      taskMap.set(task.task_id, {
        ...task,
        dependencies: task.dependent_task_ids || [],
        dependents: []
      });
      dependencyMap.set(task.task_id, task.dependent_task_ids || []);
    });

    // 计算反向依赖（哪些任务依赖于当前任务）
    tasks.forEach(task => {
      task.dependent_task_ids?.forEach(depId => {
        const depTask = taskMap.get(depId);
        if (depTask) {
          depTask.dependents.push(task.task_id);
        }
      });
    });

    // 计算任务层级（用于布局）
    const levels = new Map();
    const visited = new Set();
    
    const calculateLevel = (taskId, currentLevel = 0) => {
      if (visited.has(taskId)) return levels.get(taskId) || 0;
      
      visited.add(taskId);
      const task = taskMap.get(taskId);
      if (!task) return currentLevel;
      
      let maxDepLevel = -1;
      task.dependencies.forEach(depId => {
        const depLevel = calculateLevel(depId, currentLevel);
        maxDepLevel = Math.max(maxDepLevel, depLevel);
      });
      
      const level = maxDepLevel + 1;
      levels.set(taskId, level);
      return level;
    };

    tasks.forEach(task => calculateLevel(task.task_id));
    
    return { taskMap, levels };
  }, [tasks]);

  // 获取任务状态
  const getTaskStatus = (task) => {
    if (task.is_finished) return 'completed';
    if (task.is_success === false) return 'failed';
    if (task.result) return 'in_progress';
    return 'pending';
  };

  // 获取状态样式
  const getStatusStyle = (status) => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-green-100 dark:bg-green-900/20',
          border: 'border-green-300 dark:border-green-700',
          text: 'text-green-700 dark:text-green-300',
          icon: CheckCircle
        };
      case 'in_progress':
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/20',
          border: 'border-blue-300 dark:border-blue-700',
          text: 'text-blue-700 dark:text-blue-300',
          icon: Play
        };
      case 'failed':
        return {
          bg: 'bg-red-100 dark:bg-red-900/20',
          border: 'border-red-300 dark:border-red-700',
          text: 'text-red-700 dark:text-red-300',
          icon: AlertCircle
        };
      default:
        return {
          bg: 'bg-gray-100 dark:bg-gray-800',
          border: 'border-gray-300 dark:border-gray-600',
          text: 'text-gray-700 dark:text-gray-300',
          icon: Clock
        };
    }
  };

  // 渲染任务节点
  const renderTaskNode = (task, level) => {
    const status = getTaskStatus(task);
    const style = getStatusStyle(status);
    const Icon = style.icon;
    const isSelected = selectedTask?.task_id === task.task_id;

    return (
      <div
        key={task.task_id}
        className={`
          relative p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
          ${style.bg} ${style.border} ${style.text}
          ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
          hover:shadow-md transform hover:scale-105
        `}
        onClick={() => setSelectedTask(task)}
        style={{
          minWidth: '200px',
          maxWidth: '250px'
        }}
      >
        <div className="flex items-start gap-2">
          <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">
                #{task.task_id}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {task.task_type || 'other'}
              </Badge>
            </div>
            <p className="text-sm font-medium leading-tight mb-2">
              {task.instruction}
            </p>
            {task.dependencies.length > 0 && (
              <div className="text-xs opacity-75">
                依赖: {task.dependencies.join(', ')}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 渲染连接线
  const renderConnections = () => {
    return tasks.map(task => {
      return task.dependent_task_ids?.map(depId => (
        <div
          key={`${depId}-${task.task_id}`}
          className="absolute flex items-center text-gray-400"
        >
          <ArrowRight className="h-4 w-4" />
        </div>
      ));
    });
  };

  // 按层级组织任务
  const tasksByLevel = useMemo(() => {
    const levels = new Map();
    tasks.forEach(task => {
      const level = taskGraph.levels.get(task.task_id) || 0;
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level).push(task);
    });
    return levels;
  }, [tasks, taskGraph]);

  const maxLevel = Math.max(...Array.from(tasksByLevel.keys()));

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {tasks.length} 个任务
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 px-2"
          >
            {isExpanded ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={`overflow-auto ${isExpanded ? 'max-h-none' : 'max-h-80'}`}>
          {/* 流程图视图 */}
          <div className="space-y-6">
            {Array.from({ length: maxLevel + 1 }, (_, level) => {
              const levelTasks = tasksByLevel.get(level) || [];
              if (levelTasks.length === 0) return null;

              return (
                <div key={level} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      阶段 {level + 1}
                    </Badge>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {levelTasks.map(task => renderTaskNode(task, level))}
                  </div>
                  {level < maxLevel && (
                    <div className="flex justify-center">
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 任务详情面板 */}
          {selectedTask && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
              <h4 className="font-medium mb-2">任务详情</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">ID:</span> {selectedTask.task_id}
                </div>
                <div>
                  <span className="font-medium">类型:</span> {selectedTask.task_type || 'other'}
                </div>
                <div>
                  <span className="font-medium">描述:</span> {selectedTask.instruction}
                </div>
                {selectedTask.dependent_task_ids?.length > 0 && (
                  <div>
                    <span className="font-medium">依赖任务:</span> {selectedTask.dependent_task_ids.join(', ')}
                  </div>
                )}
                {selectedTask.code && (
                  <div>
                    <span className="font-medium">代码:</span>
                    <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto">
                      {selectedTask.code}
                    </pre>
                  </div>
                )}
                {selectedTask.result && (
                  <div>
                    <span className="font-medium">结果:</span>
                    <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs">
                      {selectedTask.result}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>点击任务查看详情</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>待处理</span>
            </div>
            <div className="flex items-center gap-1">
              <Play className="h-3 w-3" />
              <span>进行中</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              <span>已完成</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskFlowViewer;

