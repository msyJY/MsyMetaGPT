import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Menu, MessageSquare, X, Bot, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AGENTS from '@/constants/agents';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';

// 中间区域宽度调整 (change these constants to adjust defaults)
const MID_DEFAULT = 180; // default width in 
const MID_MIN = 100; // minimum width
const MID_MAX = 520; // maximum width

const Layout = ({
  children,
  currentPage,
  onPageChange,
  onClearHistory,
  sidebarOpen,
  setSidebarOpen,
  selectedAgents = [],
  onAgentToggle,
  conversations = [],
  onSelectConversation,
  selectedConversationId,
  onNewConversation
}) => {
  const [sidebarWidth, setSidebarWidth] = useState(MID_DEFAULT);
  const isResizingRef = useRef(false);
  const sidebarRef = useRef(null);
  const activeAgents = Array.isArray(selectedAgents) ? selectedAgents : [];
  const DI_ROLE_ID = 'data_interpreter';
  const diSelected = activeAgents.includes(DI_ROLE_ID);
  const otherSelected = activeAgents.some((id) => id !== DI_ROLE_ID);
  const disableDI = otherSelected;
  const disableOthers = diSelected;

  const triggerNewChat = useCallback(() => {
    if (typeof onNewConversation === 'function') {
      onNewConversation();
      return;
    }
    if (typeof onPageChange === 'function') {
      onPageChange('chat');
    }
  }, [onNewConversation, onPageChange]);

  const handleNavigation = useCallback((itemId) => {
    if (itemId === 'chat') {
      triggerNewChat();
      return;
    }
    if (typeof onPageChange === 'function') {
      onPageChange(itemId);
    }
  }, [triggerNewChat, onPageChange]);

  const getRestrictionText = (agentId) => {
    if (agentId === DI_ROLE_ID && disableDI) {
      return 'DI 独立功能无法搭配其他项目角色';
    }
    if (agentId !== DI_ROLE_ID && disableOthers) {
      return '已选择 DI，其他项目角色暂不可用';
    }
    return '';
  };

  const navigationItems = [
    { id: 'chat', label: '新对话', icon: MessageSquare, shortcut: 'n' }
  ];

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const time = new Date(timestamp);
    if (Number.isNaN(time.getTime())) return '';

    const diffMs = Date.now() - time.getTime();
    const minuteMs = 60 * 1000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;

    if (diffMs < minuteMs) {
      return '刚刚';
    }
    if (diffMs < hourMs) {
      const minutes = Math.floor(diffMs / minuteMs);
      return `${minutes}分钟前`;
    }
    if (diffMs < dayMs) {
      const hours = Math.floor(diffMs / hourMs);
      return `${hours}小时前`;
    }
    const days = Math.floor(diffMs / dayMs);
    if (days < 7) {
      return `${days}天前`;
    }
    return time.toLocaleDateString('zh-CN');
  };

  const latestConversations = useMemo(() => {
    if (!Array.isArray(conversations)) return [];
    return [...conversations]
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 15);
  }, [conversations]);

  const shortcuts = [
    { key: 'n', ctrlKey: true, callback: triggerNewChat },
    { key: 'a', ctrlKey: true, callback: () => onPageChange('agents') },
    { key: 'b', ctrlKey: true, callback: () => setSidebarOpen(prev => !prev) }
  ];
  useKeyboardShortcuts(shortcuts);

  useEffect(() => {
    function onMouseMove(e) {
      if (!isResizingRef.current || !sidebarRef.current) return;
      const rect = sidebarRef.current.getBoundingClientRect();
      const w = Math.max(MID_MIN, Math.min(MID_MAX, e.clientX - rect.left));
      setSidebarWidth(w);
    }
    function onMouseUp() {
      isResizingRef.current = false;
      document.body.style.cursor = '';
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const getPageTitle = (pageId) => {
    const titles = { chat: 'MetaGPT 多智能体协作平台', agents: '智能体角色' };
    return titles[pageId] || 'MetaGPT 多智能体协作平台';
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Middle internal sidebar (resizable) */}
      <div ref={sidebarRef} className="overflow-hidden border-r border-border h-full">
            <div className="flex flex-col h-full">
              <div className="transition-[max-width] duration-300 ease-in-out" style={{ maxWidth: sidebarOpen ? sidebarWidth : 0 }}>
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0">
                <Bot className="h-6 w-6 text-primary" />
                <h1 className="text-base font-semibold text-foreground truncate">
                  MetaGPT 多智能体协作平台
                </h1>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)} className="lg:hidden">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-4">
            <nav className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant={currentPage === item.id ? 'default' : 'ghost'}
                    className="w-full justify-start group text-sm p-2"
                    onClick={() => handleNavigation(item.id)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                  </Button>
                );
              })}
            </nav>
          </div>

          <Separator />

          {currentPage === 'chat' && (
            <div className="flex-1 p-4">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">历史记录</h3>
              <ScrollArea className="h-[calc(100vh-240px)]">
                <div className="space-y-2 pr-1">
                  {latestConversations.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-6 text-center">
                      暂无历史任务
                    </div>
                  ) : (
                    latestConversations.map((conversation) => (
                      <Button
                        key={conversation.id}
                        variant="ghost"
                        className={`w-full justify-start text-left h-auto p-3 hover:bg-accent/50 transition-colors border-none shadow-none focus-visible:ring-offset-0 ${
                          conversation.id === selectedConversationId ? 'bg-accent/30' : ''
                        }`}
                        onClick={() => {
                          if (typeof onSelectConversation === 'function') {
                            onSelectConversation(conversation);
                          }
                        }}
                      >
                        <div className="truncate">
                          <div className="text-sm truncate">
                            {conversation.title || '未命名任务'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatRelativeTime(conversation.timestamp)}
                          </div>
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="p-4 border-t border-border">{/* compact footer (removed shortcuts) */}</div>
          </div>
        </div>
      </div>

      {/* drag handle between sidebar and main content */}
      <div role="separator" aria-orientation="vertical" onMouseDown={() => { isResizingRef.current = true; document.body.style.cursor = 'col-resize'; }} className="w-1 cursor-col-resize bg-border hover:bg-border/70 transition-all duration-300 ease-in-out" />

      {/* Main Content (restored) */}
  <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out">
        <header className="h-16 border-b border-border flex items-center px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center" style={{ width: 120 }}>
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-2" title="切换侧边栏 (Ctrl+B)"><Menu className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-7xl w-full mx-auto flex justify-center">
              {currentPage === 'chat' ? (
                <TooltipProvider>
                  <div className="flex items-center gap-3 flex-wrap justify-center">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">请选择构建团队的 role</span>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    {AGENTS.map((agent) => {
                      const Icon = agent.icon;
                      const isSelected = activeAgents.includes(agent.id);
                      const isDisabled = (agent.id === DI_ROLE_ID && disableDI) || (agent.id !== DI_ROLE_ID && disableOthers);
                      const restrictionText = getRestrictionText(agent.id);
                      return (
                        <Tooltip key={agent.id}>
                          <TooltipTrigger asChild>
                            <div
                              role="button"
                              aria-pressed={isSelected}
                              aria-disabled={isDisabled}
                              onClick={() => {
                                if (!isDisabled && typeof onAgentToggle === 'function') {
                                  onAgentToggle(agent.id);
                                }
                              }}
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                isSelected ? 'ring-2 ring-primary scale-105' : 'opacity-80 hover:scale-105'
                              } ${isDisabled ? 'cursor-not-allowed opacity-50 hover:scale-100' : 'cursor-pointer'}`}
                            >
                              <div className={`${agent.color} w-8 h-8 rounded-full flex items-center justify-center text-white`}>
                                <Icon className="w-4 h-4" />
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <div className="max-w-xs space-y-1">
                              <div className="font-medium">{agent.name}</div>
                              <div className="text-xs text-muted-foreground">{agent.description}</div>
                              {restrictionText && (
                                <div className="text-xs text-amber-500">
                                  {restrictionText}
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                  </div>
                </TooltipProvider>
              ) : (
                <h2 className="text-lg font-semibold text-center">{getPageTitle(currentPage)}</h2>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end" style={{ width: 120 }}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => { if (typeof onClearHistory === 'function') onClearHistory(); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="text-xs">清除历史</div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
};

export default Layout;

