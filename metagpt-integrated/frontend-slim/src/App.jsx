import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import ChatInterfaceStream from './components/ChatInterfaceStream';
import ChatHistory from './components/ChatHistory';
import AgentSelector from './components/AgentSelector';
import SettingsPanelSimple from './components/SettingsPanelSimple';
import TestStreamingDemo from './components/TestStreamingDemo';
import './App.css';

function App() {
  const DEFAULT_SELECTED_AGENTS = ['product_manager'];
  const [currentPage, setCurrentPage] = useState('chat');
  const [selectedAgents, setSelectedAgents] = useState(DEFAULT_SELECTED_AGENTS);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [clearHistorySignal, setClearHistorySignal] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [newConversationSignal, setNewConversationSignal] = useState(0);

  const loadConversationsFromStorage = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('metagpt_conversations_list') || '[]');
      if (Array.isArray(stored)) {
        const sorted = [...stored].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        setConversations(sorted);
      } else {
        setConversations([]);
      }
    } catch (error) {
      console.error('加载历史任务失败:', error);
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    loadConversationsFromStorage();
  }, [loadConversationsFromStorage]);

  useEffect(() => {
    if (currentPage === 'chat') {
      loadConversationsFromStorage();
    }
  }, [currentPage, loadConversationsFromStorage]);

  const handleConversationsUpdate = useCallback((updatedList) => {
    if (Array.isArray(updatedList)) {
      const sorted = [...updatedList].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      setConversations(sorted);
    } else {
      loadConversationsFromStorage();
    }
  }, [loadConversationsFromStorage]);

  const handleNewConversation = useCallback(() => {
    setNewConversationSignal(prev => prev + 1);
    setCurrentPage('chat');
  }, []);

  // Fallback: listen to a global event so chat components can request collapse
  React.useEffect(() => {
    const handler = () => {
      try { localStorage.setItem('metagpt_sidebar_collapsed_by_send', Date.now().toString()); } catch (e) {}
      setSidebarOpen(false);
    };
    window.addEventListener('metagpt:collapseSidebar', handler);
    return () => window.removeEventListener('metagpt:collapseSidebar', handler);
  }, []);

  const handleAgentToggle = (agentId) => {
    setSelectedAgents(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  // 处理从历史记录选择对话
  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setCurrentPage('chat');
  };

  const triggerClearHistory = () => {
    // signal chat components to clear history and reset selected agents to default
    setSelectedAgents(DEFAULT_SELECTED_AGENTS);
    setClearHistorySignal(prev => prev + 1);
    setSelectedConversation(null);
    setConversations([]);
    try {
      localStorage.removeItem('metagpt_conversations_list');
    } catch (error) {
      console.error('清除历史任务失败:', error);
    }
  };

  // 检查是否是测试页面
  if (window.location.pathname === '/test') {
    return <TestStreamingDemo />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'chat':
        return (
          <ChatInterfaceStream 
            selectedAgents={selectedAgents}
            selectedConversation={selectedConversation}
            onConversationChange={setSelectedConversation}
            onConversationsUpdate={handleConversationsUpdate}
            clearHistorySignal={clearHistorySignal}
            onRequestCollapseSidebar={() => { try { localStorage.setItem('metagpt_sidebar_collapsed_by_send', Date.now().toString()); } catch(e){}; setSidebarOpen(false); }}
            newConversationSignal={newConversationSignal}
          />
        );
      case 'history':
        return (
          <ChatHistory 
            onSelectConversation={handleSelectConversation}
            onClose={() => setCurrentPage('chat')}
          />
        );
      case 'agents':
        return (
          <AgentSelector 
            selectedAgents={selectedAgents} 
            onAgentToggle={handleAgentToggle} 
          />
        );
      case 'settings':
        return <SettingsPanelSimple />;
      default:
  return <ChatInterfaceStream selectedAgents={selectedAgents} selectedConversation={selectedConversation} onConversationChange={setSelectedConversation} onConversationsUpdate={handleConversationsUpdate} clearHistorySignal={clearHistorySignal} onRequestCollapseSidebar={() => { try { localStorage.setItem('metagpt_sidebar_collapsed_by_send', Date.now().toString()); } catch(e){}; setSidebarOpen(false); }} newConversationSignal={newConversationSignal} />;
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      onPageChange={setCurrentPage}
      onClearHistory={triggerClearHistory}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      selectedAgents={selectedAgents}
      onAgentToggle={handleAgentToggle}
      conversations={conversations}
      onSelectConversation={handleSelectConversation}
      selectedConversationId={selectedConversation?.id}
      onNewConversation={handleNewConversation}
    >
      {renderCurrentPage()}
    </Layout>
  );
}

export default App;
