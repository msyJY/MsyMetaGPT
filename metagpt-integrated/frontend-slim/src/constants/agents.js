import { Target, Brain, Code, Briefcase, Wrench, BarChart } from 'lucide-react';

export const AGENTS = [
  {
    id: 'product_manager',
    name: '产品经理',
    description: '负责需求分析、用户故事编写和产品规划',
    icon: Target,
    color: 'bg-blue-500',
    skills: ['需求分析', '用户故事', '产品规划', '竞品分析']
  },
  {
    id: 'architect',
    name: '架构师',
    description: '设计系统架构、技术选型和数据库设计',
    icon: Brain,
    color: 'bg-purple-500',
    skills: ['系统架构', '技术选型', '数据库设计', '性能优化']
  },
  {
    id: 'engineer',
    name: '工程师',
    description: '负责代码实现、功能开发和技术实现',
    icon: Code,
    color: 'bg-green-500',
    skills: ['代码实现', '功能开发', '单元测试', '代码审查']
  },
  {
    id: 'project_manager',
    name: '项目经理',
    description: '协调项目进度、资源管理和质量控制',
    icon: Briefcase,
    color: 'bg-orange-500',
    skills: ['项目管理', '进度控制', '资源协调', '风险管理']
  },
  {
    id: 'qa_engineer',
    name: '测试工程师',
    description: '负责数据分析、质量保证、测试用例编写和bug修复',
    icon: Wrench,
    color: 'bg-red-500',
    skills: ['数据分析', '测试设计', '质量保证', 'Bug修复', '自动化测试']
  },
  {
    id: 'data_interpreter',
    name: '数据解释器',
    description: '数据可视化、自主建模、邮件助手，报表生成',
    icon: BarChart,
    color: 'bg-indigo-500',
    skills: ['数据可视化', '自主建模', '邮件助手', '报表生成']
  }
];

export default AGENTS;
