import React, { useState } from 'react';
import AGENTS from '@/constants/agents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Briefcase, 
  Code, 
  Settings, 
  Users, 
  CheckCircle,
  Brain,
  Target,
  Wrench
} from 'lucide-react';

const AgentSelector = ({ selectedAgents, onAgentToggle }) => {
  const agents = AGENTS;
  const DI_ROLE_ID = 'data_interpreter';
  const diSelected = selectedAgents.includes(DI_ROLE_ID);
  const otherSelected = selectedAgents.some((id) => id !== DI_ROLE_ID);
  const disableDI = otherSelected;
  const disableOthers = diSelected;
  const getRestrictionText = (agentId) => {
    if (agentId === DI_ROLE_ID && disableDI) {
      return 'DI 独立功能无法搭配其他项目角色';
    }
    if (agentId !== DI_ROLE_ID && disableOthers) {
      return '已选择 DI，其他项目角色暂不可用';
    }
    return '';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">选择智能体角色</h2>
        <p className="text-muted-foreground">
          选择参与项目的智能体角色，不同角色将从各自专业角度参与项目开发
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const Icon = agent.icon;
          const isSelected = selectedAgents.includes(agent.id);
          const isDisabled =
            (agent.id === DI_ROLE_ID && disableDI) ||
            (agent.id !== DI_ROLE_ID && disableOthers);
          const restrictionText = getRestrictionText(agent.id);
          
          return (
            <Card 
              key={agent.id}
              className={`transition-all duration-200 hover:shadow-lg ${
                isSelected ? 'ring-2 ring-primary shadow-lg' : ''
              } ${
                isDisabled ? 'cursor-not-allowed opacity-50 pointer-events-none' : 'cursor-pointer'
              }`}
              onClick={() => {
                if (!isDisabled) {
                  onAgentToggle(agent.id);
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${agent.color} text-white`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle className="w-5 h-5 text-primary" />
                  )}
                </div>
                <CardDescription className="text-sm">
                  {agent.description}
                </CardDescription>
                {restrictionText && (
                  <CardDescription className="text-xs text-amber-500 mt-1">
                    {restrictionText}
                  </CardDescription>
                )}
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-2">核心技能</h4>
                    <div className="flex flex-wrap gap-1">
                      {agent.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">已选择的角色 ({selectedAgents.length})</h3>
        <div className="flex flex-wrap gap-2">
          {selectedAgents.map((agentId) => {
            const agent = agents.find(a => a.id === agentId);
            return agent ? (
              <Badge key={agentId} variant="default" className="flex items-center space-x-1">
                <agent.icon className="w-3 h-3" />
                <span>{agent.name}</span>
              </Badge>
            ) : null;
          })}
        </div>
        {selectedAgents.length === 0 && (
          <p className="text-sm text-muted-foreground">请选择至少一个智能体角色</p>
        )}
      </div>
    </div>
  );
};

export default AgentSelector;

