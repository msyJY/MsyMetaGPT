import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const QuickStart = ({ onSelectExample }) => {
  const examples = [
    {
      id: 'web-app',
      title: '创建Web应用',
      prompt: '创建一个任务管理Web应用，包含用户注册登录、任务增删改查、任务分类和优先级设置功能。使用React作为前端框架，Node.js作为后端，MongoDB作为数据库。'
    },
    {
      id: 'mobile-app',
      title: '移动应用开发',
      prompt: '开发一个健身追踪移动应用，功能包括运动记录、卡路里计算、健身计划制定、进度统计图表。使用React Native框架，支持iOS和Android平台。'
    },
    {
      id: 'data-analysis',
      title: '数据分析系统',
      prompt: '创建一个销售数据分析系统，能够导入Excel/CSV文件，进行数据清洗、统计分析，生成各种图表（柱状图、折线图、饼图），并支持导出报告。使用Python和Pandas进行数据处理，使用Plotly进行可视化。'
    },
    {
      id: 'game-development',
      title: '游戏开发',
      prompt: '开发一个2048数字游戏，包含游戏逻辑、动画效果、分数统计、最高分记录、游戏重置功能。使用HTML5 Canvas和JavaScript实现，添加触摸和键盘操作支持。'
    }
  ];

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium mb-2">快速开始</h3>
        <p className="text-sm text-muted-foreground">
          选择一个示例项目快速开始，或直接在下方输入框描述您的需求
        </p>
      </div>

      <div className="grid gap-3">
        {examples.map((example) => (
          <Card 
            key={example.id} 
            className="hover:shadow-sm transition-shadow cursor-pointer border-l-2 border-l-primary/20 hover:border-l-primary"
            onClick={() => onSelectExample(example)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">{example.title}</h4>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-xs h-7 px-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectExample(example);
                  }}
                >
                  使用
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default QuickStart;

