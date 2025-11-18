import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Send, 
  User, 
  Bot, 
  Copy, 
  RotateCcw,
  Loader2,
  AlertCircle,
  Paperclip,
  X,
  Square,
  Archive
} from 'lucide-react';
import MessageContent from './MessageContentNew';
import SimpleUserInput from './SimpleUserInput';
import FileUpload from './FileUpload';
import EnhancedStreamingMessage from './EnhancedStreamingMessage';
import WorkspaceFilePanel from './WorkspaceFilePanel';
import { metaGPTAPI } from '../services/api';

const decodeEscapedText = (text = '') => {
  if (!text) return '';
  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch (err) {
        return match;
      }
    });
};

const extractTaggedContent = (text = '', tag = 'CONTENT') => {
  if (!text) return null;
  const pattern = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\/${tag}\\]`, 'i');
  const match = pattern.exec(text);
  if (!match) return null;
  const body = match[1] || '';
  return body.trim() || null;
};

const MAX_STATUS_LINES = 12;
const stripThinkTags = (text = '') => text.replace(/<\/?think>/gi, '');

const splitThinkFromChunk = (text = '') => {
  if (!text) {
    return { logText: '', thinkText: '' };
  }

  const THINK_TAG_REGEX = /<\/?think>/gi;
  if (!THINK_TAG_REGEX.test(text)) {
    return { logText: text, thinkText: '' };
  }

  let insideThink = false;
  const segments = text.split(/(<\/?think>)/gi);
  const logParts = [];
  const thinkParts = [];

  segments.forEach(segment => {
    if (!segment) {
      return;
    }
    const lower = segment.toLowerCase();
    if (lower === '<think>') {
      insideThink = true;
      return;
    }
    if (lower === '</think>') {
      insideThink = false;
      return;
    }
    if (insideThink) {
      thinkParts.push(segment);
    } else {
      logParts.push(segment);
    }
  });

  return {
    logText: logParts.join('').trim(),
    thinkText: thinkParts.join('').trim()
  };
};

const ChatInterfaceStream = ({
  selectedAgents = ['product_manager', 'architect', 'engineer'],
  selectedConversation,
  onConversationChange,
  onConversationsUpdate,
  clearHistorySignal,
  onRequestCollapseSidebar,
  newConversationSignal = 0
}) => {
  const activeAgents = Array.isArray(selectedAgents) ? selectedAgents : [];
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [streamingStatusLines, setStreamingStatusLines] = useState([]);
  const [thinkStreamingMessage, setThinkStreamingMessage] = useState('');
  const [isThinkStreaming, setIsThinkStreaming] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAbortController, setCurrentAbortController] = useState(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(false);
  const [filePickerTrigger, setFilePickerTrigger] = useState(0);
  const scrollAreaRef = useRef(null);
  const textareaRef = useRef(null);
  const eventSourceRef = useRef(null);
  // 持久化保存最新流内容，避免闭包读取到过期的 state
  const streamingRef = useRef('');
  const streamingMessageStateRef = useRef('');
  const thinkStreamingRef = useRef('');
  const thinkSegmentCountRef = useRef(0);
  const sessionModeRef = useRef('unknown'); // 'unknown' | 'chat' | 'agent'
  const thinkSegmentsRef = useRef([]);
  const hasChatDeltaRef = useRef(false);
  const lastOutputChunkRef = useRef('');
  const stoppedMessageIdRef = useRef(null);
  const skipNextConversationUpdateRef = useRef(false);

  const updateSessionMode = useCallback((mode) => {
    if (!mode) return;
    const current = sessionModeRef.current;
    if (mode === 'agent') {
      if (current !== 'agent') {
        sessionModeRef.current = 'agent';
      }
      return;
    }
    if (mode === 'chat' && current === 'unknown') {
      sessionModeRef.current = 'chat';
    }
  }, []);

  const resetThinkingState = useCallback(() => {
    thinkSegmentCountRef.current = 0;
    thinkSegmentsRef.current = [];
    thinkStreamingRef.current = '';
    setThinkStreamingMessage('');
    setIsThinkStreaming(false);
  }, []);

  const refreshThinkingDisplay = useCallback(() => {
    const segments = thinkSegmentsRef.current;
    if (!segments.length) {
      thinkStreamingRef.current = '';
      setThinkStreamingMessage('');
      return;
    }

    let mode = sessionModeRef.current;
    if (mode !== 'agent' && segments.length > 1) {
      mode = 'agent';
      sessionModeRef.current = 'agent';
    }

    if (mode === 'agent') {
      const formatted = segments
        .map((segment, index) => {
          const label = `—— 思考阶段 ${index + 1} ——`;
          const body = (segment.content || '').replace(/^\n+/, '');
          return body ? `${label}\n${body}` : label;
        })
        .join('\n\n');
      thinkStreamingRef.current = formatted;
      setThinkStreamingMessage(formatted);
      return;
    }

    const chatContent = segments[0].content || '';
    thinkStreamingRef.current = chatContent;
    setThinkStreamingMessage(chatContent);
  }, []);

  // 对话历史持久化相关
  const STORAGE_KEY = 'metagpt_chat_history';
  const SESSION_STORAGE_KEY = 'metagpt_session_id';
  const CONVERSATIONS_KEY = 'metagpt_conversations_list';

  // 保存对话历史到本地存储
  const saveMessagesToStorage = (messagesToSave) => {
    try {
      const historyData = {
        messages: messagesToSave,
        timestamp: Date.now(),
        sessionId,
  agents: activeAgents,
        conversationId: selectedConversation?.id || null
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(historyData));

      // 同时保存到对话列表
      saveToConversationsList(messagesToSave);
    } catch (error) {
      console.error('保存对话历史失败:', error);
    }
  };

  // 保存到对话列表
  const saveToConversationsList = (messagesToSave) => {
    try {
      if (messagesToSave.length === 0) return;

      const conversations = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || '[]');
      const userMessage = messagesToSave.find(msg => msg.type === 'user');
      const assistantMessage = messagesToSave.find(msg => msg.type === 'assistant');

      if (!userMessage) return;

      const conversationData = {
        id: selectedConversation?.id || `conv_${Date.now()}`,
        title: userMessage.content.substring(0, 50) + (userMessage.content.length > 50 ? '...' : ''),
        preview: assistantMessage ? assistantMessage.content.substring(0, 100) + (assistantMessage.content.length > 100 ? '...' : '') : '等待回复...',
        timestamp: new Date().toISOString(),
  agents: activeAgents,
        messages: messagesToSave,
        sessionId
      };

      // 更新或添加对话
      const existingIndex = conversations.findIndex(conv => conv.id === conversationData.id);
      if (existingIndex >= 0) {
        conversations[existingIndex] = conversationData;
      } else {
        conversations.unshift(conversationData);
      }

      // 只保留最近100个对话
      const limitedConversations = conversations.slice(0, 100);
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(limitedConversations));

      if (typeof onConversationsUpdate === 'function') {
        onConversationsUpdate(limitedConversations);
      }

      if (skipNextConversationUpdateRef.current) {
        skipNextConversationUpdateRef.current = false;
      } else if (onConversationChange) {
        onConversationChange(conversationData);
      }
    } catch (error) {
      console.error('保存对话列表失败:', error);
    }
  };

  // 从本地存储加载对话历史
  const loadMessagesFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const historyData = JSON.parse(stored);
        // 检查数据是否在24小时内
        const isRecent = Date.now() - historyData.timestamp < 24 * 60 * 60 * 1000;
        if (isRecent && historyData.messages) {
          setMessages(historyData.messages);
          if (historyData.sessionId) {
            setSessionId(historyData.sessionId);
          }
        }
      }
    } catch (error) {
      console.error('加载对话历史失败:', error);
    }
  };

  // 从选中的对话加载消息
  const loadConversationMessages = (conversation) => {
    try {
      if (conversation && conversation.messages) {
        setMessages(conversation.messages);
        setSessionId(conversation.sessionId || null);

        // 保存当前对话到存储
        const historyData = {
          messages: conversation.messages,
          timestamp: Date.now(),
          sessionId: conversation.sessionId,
          agents: conversation.agents || activeAgents,
          conversationId: conversation.id
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(historyData));
      }
    } catch (error) {
      console.error('加载对话消息失败:', error);
    }
  };

  // 清除对话历史
  const clearChatHistory = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);

    // 通知父组件对话已清除
    if (onConversationChange) {
      onConversationChange(null);
    }
  };

  // 响应外部清除历史信号
  React.useEffect(() => {
    if (typeof clearHistorySignal !== 'undefined') {
      // 每次信号变化都触发清除
      clearChatHistory();
    }
  }, [clearHistorySignal]);

  useEffect(() => {
    if (!newConversationSignal) {
      return;
    }

    const previousController = currentAbortController;
    const previousSessionId = sessionId;

    if (previousController) {
      try {
        previousController.abort();
      } catch (error) {
        console.warn('终止旧的流式请求失败:', error);
      }
    }
    setCurrentAbortController(null);

    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch (error) {
        console.warn('关闭SSE连接失败:', error);
      }
      eventSourceRef.current = null;
    }

    resetThinkingState();
    sessionModeRef.current = 'unknown';
    hasChatDeltaRef.current = false;
    streamingRef.current = '';
    streamingMessageStateRef.current = '';
    thinkStreamingRef.current = '';
    thinkSegmentCountRef.current = 0;
    thinkSegmentsRef.current = [];
    stoppedMessageIdRef.current = null;
    lastOutputChunkRef.current = '';

    setThinkStreamingMessage('');
    setIsThinkStreaming(false);
    setStreamingMessage('');
    setStreamingStatusLines([]);
    setIsStreaming(false);
    setIsLoading(false);
    setError(null);
    setUploadedFiles([]);
    setShowFileUpload(false);
    setInput('');
    setShowWorkspacePanel(false);

    setMessages([]);
    setSessionId(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn('清除本地存储对话失败:', error);
    }
    if (onConversationChange) {
      onConversationChange(null);
    }

    (async () => {
      if (!previousSessionId) {
        return;
      }
      try {
        await metaGPTAPI.stopProcessing(previousSessionId);
      } catch (error) {
        console.error('停止旧的 MetaGPT 会话失败:', error);
      }
    })();
  }, [newConversationSignal, resetThinkingState]);

  // 组件加载时恢复对话历史
  useEffect(() => {
    if (selectedConversation) {
      // 如果有选中的对话，加载该对话
      loadConversationMessages(selectedConversation);
    } else {
      // 否则加载最近的对话历史
      loadMessagesFromStorage();
    }
  }, [selectedConversation]);

  // 监听选中对话的变化
  useEffect(() => {
    if (selectedConversation) {
      loadConversationMessages(selectedConversation);
    }
  }, [selectedConversation]);

  // 当消息更新时保存到本地存储
  useEffect(() => {
    if (messages.length > 0) {
      saveMessagesToStorage(messages);
    }
  }, [messages, sessionId]);

  // 自动滚动到底部 - 优化滚动行为
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        // 检查用户是否在底部附近（允许一些误差）
        if (isAutoScrollEnabled) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }
  }, [messages, streamingMessage, streamingStatusLines, isStreaming, isAutoScrollEnabled, thinkStreamingMessage]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) {
      return;
    }

    const handleScroll = () => {
      const nearBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 120;
      setIsAutoScrollEnabled(nearBottom);
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    streamingMessageStateRef.current = streamingMessage;
  }, [streamingMessage]);

  const finalizeStop = useCallback((rawLabel) => {
    const stopLabel = (rawLabel || '').trim() || '处理已停止';
    const stopMarker = `--- ${stopLabel} ---`;
    const pendingContent = (() => {
      const fromStream = (streamingRef.current || '').trim();
      if (fromStream) return fromStream;
      const fromState = (streamingMessageStateRef.current || '').trim();
      if (fromState) return fromState;
      return '';
    })();

    let assignedId = stoppedMessageIdRef.current;

    let nextId = assignedId;
    setMessages(prevMessages => {
      const safePrev = Array.isArray(prevMessages) ? prevMessages : [];
      if (nextId) {
        return safePrev.map(msg => {
          if (msg.id !== nextId) {
            return msg;
          }
          const baseContentRaw = (msg.content || '').trim();
          const effectiveBase = baseContentRaw || pendingContent;
          const mergedContent = effectiveBase
            ? (effectiveBase.includes(stopMarker)
                ? effectiveBase
                : [effectiveBase, stopMarker].filter(Boolean).join('\n\n'))
            : stopMarker;
          return {
            ...msg,
            content: mergedContent,
            isPartialStop: true
          };
        });
      }

      nextId = `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const baseContent = [pendingContent, stopMarker].filter(Boolean).join('\n\n') || stopMarker;
      const stoppedMessage = {
        id: nextId,
        type: 'assistant',
        content: baseContent,
        timestamp: new Date(),
        role: 'assistant',
        agents: activeAgents,
        team_type: 'default',
        isPartialStop: true
      };
      console.log('停止时的流式消息已保存到历史:', stoppedMessage);
      return [...safePrev, stoppedMessage];
    });

    stoppedMessageIdRef.current = nextId;
    setIsStreaming(false);
    setStreamingMessage('');
    streamingMessageStateRef.current = '';
    setStreamingStatusLines([]);
    streamingRef.current = '';
    lastOutputChunkRef.current = '';
    resetThinkingState();
    sessionModeRef.current = 'unknown';
    hasChatDeltaRef.current = false;
  }, [activeAgents, resetThinkingState]);

  // 处理停止/暂停
  // 停止处理
  const handleStop = async () => {
    if (currentAbortController) {
      try { currentAbortController.abort(); } catch {}
      setCurrentAbortController(null);
    }

    if (sessionId) {
      try {
        await metaGPTAPI.stopProcessing(sessionId);
      } catch (error) {
        console.error('停止后端会话失败:', error);
      }
    }
    finalizeStop('处理已停止');
  };

  const handleStopProcessing = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    resetThinkingState();
    sessionModeRef.current = 'unknown';

    // 如果有流式消息内容，保存到消息历史中
    setStreamingMessage(prev => {
      if (prev.trim()) {
        const tempId = `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const stoppedMessage = {
          id: tempId,
          type: 'assistant',
          content: prev + '\n\n--- 用户手动停止处理 ---',
          timestamp: new Date(),
          role: 'assistant',
          agents: activeAgents,
          team_type: 'default',
          isPartialStop: true
        };

        setMessages(prevMessages => [...prevMessages, stoppedMessage]);
        stoppedMessageIdRef.current = tempId;
        console.log('手动停止时的流式消息已保存到历史:', stoppedMessage);
      }

      return ''; // 立即清空流式消息
    });

    setStreamingStatusLines([]);
    streamingRef.current = '';
    lastOutputChunkRef.current = '';
    hasChatDeltaRef.current = false;
    setIsStreaming(false);
  };

  const appendOutputChunk = useCallback((rawContent) => {
    if (!rawContent || typeof rawContent !== 'string') {
      return;
    }

    const decoded = decodeEscapedText(rawContent);
    if (!decoded) {
      return;
    }

    const sanitizedChunk = decoded.replace(/\r/g, '');
    const { logText: chunkWithoutThink, thinkText: extractedThink } = splitThinkFromChunk(sanitizedChunk);

    if (extractedThink) {
      setIsThinkStreaming(true);
      const segments = thinkSegmentsRef.current;
      if (!segments.length) {
        segments.push({ content: '' });
      }
      const addition = stripThinkTags(extractedThink);
      if (addition) {
        const lastIndex = segments.length - 1;
        const baseContent = segments[lastIndex].content || '';
        segments[lastIndex].content = `${baseContent}${addition}`;
        refreshThinkingDisplay();
      }
    }

    const effectiveChunk = chunkWithoutThink;
    if (!effectiveChunk) {
      lastOutputChunkRef.current = '';
      return;
    }

    const normalizedForDedup = effectiveChunk.trim();
    if (normalizedForDedup && normalizedForDedup === lastOutputChunkRef.current) {
      return;
    }
    lastOutputChunkRef.current = normalizedForDedup || effectiveChunk;

    const chunkLines = effectiveChunk
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const shouldRecordStatus = chunkLines.length > 0 && effectiveChunk.length <= 400;

    if (shouldRecordStatus) {
      setStreamingStatusLines(prev => {
        const next = Array.isArray(prev) ? [...prev] : [];
        let lastLine = next[next.length - 1] || '';
        chunkLines.forEach(line => {
          if (!line) return;
          if (line === lastLine) return;
          next.push(line);
          lastLine = line;
        });
        return next.slice(-MAX_STATUS_LINES);
      });
    }

  const containsStructuredPayload = effectiveChunk.includes('[CONTENT');
  const isLargeChunk = effectiveChunk.length > 800 || chunkLines.length > 40;

    if (hasChatDeltaRef.current) {
      // chat_delta 模式会自行维护 streamingRef
      return;
    }

    const updateStreamingRefOnly = () => {
      const base = streamingRef.current || '';
      const needsNewline = base && !base.endsWith('\n') && !effectiveChunk.startsWith('\n');
      streamingRef.current = base ? `${base}${needsNewline ? '\n' : ''}${effectiveChunk}` : effectiveChunk;
    };

    if (containsStructuredPayload || isLargeChunk) {
      updateStreamingRefOnly();
      return;
    }

    setStreamingMessage(prev => {
      const base = prev || '';
      const needsNewline = base && !base.endsWith('\n') && !effectiveChunk.startsWith('\n');
      const merged = base ? `${base}${needsNewline ? '\n' : ''}${effectiveChunk}` : effectiveChunk;
      streamingRef.current = merged;
      return merged;
    });
  }, []);

  // 发送消息
  const handleSend = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;
    if (activeAgents.length === 0) {
      setError('请至少选择一个智能体角色');
      return;
    }

    const messageContent = input.trim();
    const hasFiles = uploadedFiles.length > 0;
    const filesToSend = uploadedFiles.map(f => ({
      id: f.id,
      name: f.name,
      path: f.path || null,
      size: f.size,
      type: f.type
    }));
    setInput('');
    setError(null);
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingMessage('');
    setStreamingStatusLines([]);
    streamingRef.current = '';
    lastOutputChunkRef.current = '';
    stoppedMessageIdRef.current = null;
  resetThinkingState();
  sessionModeRef.current = 'unknown';
    if (activeAgents.length > 1) {
      sessionModeRef.current = 'agent';
    }
    setIsAutoScrollEnabled(true);
    hasChatDeltaRef.current = false;

    // 添加用户消息
    const userMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'user',
      content: messageContent,
      timestamp: new Date(),
      role: 'user',
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setUploadedFiles([]);
    // 在用户消息入队后立即折叠侧边栏以改善体验
    if (typeof onRequestCollapseSidebar === 'function') {
      try { console.log('ChatInterfaceStream: calling onRequestCollapseSidebar'); onRequestCollapseSidebar(); } catch (e) { /* ignore */ }
    }

    // dispatch a global event as a fallback
    try { window.dispatchEvent(new Event('metagpt:collapseSidebar')); } catch(e) {}

    try {
      // 创建AbortController用于取消请求
      const abortController = new AbortController();
      setCurrentAbortController(abortController);

      await metaGPTAPI.sendMessageStream(messageContent, {
        selectedAgents: activeAgents,
        sessionId,
        files: filesToSend,
        signal: abortController.signal,
        onMessage: (data) => {
          switch (data.type) {
            case 'start':
              // Accept both sessionId and session_id from backend events
              const sid = data.sessionId || data.session_id;
              if (sid && !sessionId) {
                setSessionId(sid);
              }
              break;

            case 'output': {
              updateSessionMode('agent');
              appendOutputChunk(data.content);
              break;
            }

            case 'chat_delta':
              updateSessionMode('chat');
              if (!hasChatDeltaRef.current && streamingRef.current) {
                streamingRef.current = '';
                setStreamingMessage('');
              }
              setStreamingMessage(prev => {
                const appendTextRaw = data.content ?? '';
                if (!appendTextRaw) {
                  return prev;
                }
                const sanitized = decodeEscapedText(appendTextRaw).replace(/\r/g, '');
                const next = (prev || '') + sanitized;
                streamingRef.current = next;
                return next;
              });
              hasChatDeltaRef.current = true;
              lastOutputChunkRef.current = '';
              break;

            case 'chat_think_start': {
              thinkSegmentCountRef.current += 1;
              const segments = thinkSegmentsRef.current;
              segments.push({ content: '' });
              if (segments.length > 1) {
                updateSessionMode('agent');
              } else if (sessionModeRef.current === 'unknown' && hasChatDeltaRef.current) {
                updateSessionMode('chat');
              }
              refreshThinkingDisplay();
              setIsThinkStreaming(true);
              break;
            }

            case 'chat_think_delta': {
              const appendText = data.content ?? '';
              if (!appendText) {
                break;
              }
              const sanitized = stripThinkTags(decodeEscapedText(appendText));
              if (!sanitized) {
                break;
              }
              const segments = thinkSegmentsRef.current;
              if (!segments.length) {
                segments.push({ content: '' });
              }
              const lastIndex = segments.length - 1;
              const baseContent = segments[lastIndex].content || '';
              segments[lastIndex].content = `${baseContent}${sanitized}`;
              refreshThinkingDisplay();
              break;
            }
              break;

            case 'chat_think_end':
              setIsThinkStreaming(false);
              break;

            case 'final': {
              const rawReply = data.response?.content ?? data.content ?? '';
              const decodedReplyRaw = decodeEscapedText(rawReply || '');
              const decodedReply = decodedReplyRaw.trim();
              const collectedStreamRaw = decodeEscapedText(streamingRef.current || '');
              const collectedStream = collectedStreamRaw.trim();
              let finalContent = (decodedReply || collectedStream || '').trim();
              const responseAgents = Array.isArray(data.response?.agents) ? data.response.agents : activeAgents;
              const responseTeamType = data.response?.team_type || 'default';
              const statusLines = Array.isArray(data.response?.status_lines) ? data.response.status_lines : undefined;

              if (Array.isArray(responseAgents) && responseAgents.length > 1) {
                updateSessionMode('agent');
              } else if (sessionModeRef.current === 'unknown') {
                updateSessionMode('chat');
              }
              refreshThinkingDisplay();
              const thinkContent = (thinkStreamingRef.current || '').trim();

              const isMultiAgentResponse = responseTeamType === 'multi_agent' || (Array.isArray(responseAgents) && responseAgents.length > 1);
              const taggedFromDecoded = extractTaggedContent(decodedReplyRaw);
              const taggedFromStream = extractTaggedContent(collectedStreamRaw);
              const successMessage = '任务代码仓库生成成功';
              const prefixSuccessLabel = (text) => {
                const base = text || '';
                const trimmed = base.trimStart();
                if (!trimmed) {
                  return successMessage;
                }
                if (trimmed.startsWith(successMessage)) {
                  return base;
                }
                return `${successMessage}\n\n${base}`.trimEnd();
              };

              let displayContent = finalContent;
              if (isMultiAgentResponse) {
                const taggedBody = taggedFromDecoded || taggedFromStream;
                if (taggedBody) {
                  let normalizedTaggedBody = taggedBody.trim();
                  if (normalizedTaggedBody) {
                    try {
                      const parsedJson = JSON.parse(normalizedTaggedBody);
                      normalizedTaggedBody = JSON.stringify(parsedJson, null, 2);
                    } catch (err) {
                      const lines = normalizedTaggedBody.split('\n');
                      const seenLines = new Set();
                      const deduped = [];
                      lines.forEach((line) => {
                        const key = line.trim();
                        if (!key) {
                          deduped.push(line);
                          return;
                        }
                        if (seenLines.has(key)) {
                          return;
                        }
                        seenLines.add(key);
                        deduped.push(line);
                      });
                      normalizedTaggedBody = deduped.join('\n');
                    }
                  }
                  displayContent = `[CONTENT]\n${normalizedTaggedBody}\n[/CONTENT]`;
                  displayContent = prefixSuccessLabel(displayContent);
                } else {
                  const successSource = [finalContent, decodedReplyRaw, collectedStreamRaw, ...(statusLines || [])]
                    .filter(Boolean)
                    .find(text => text.includes('代码仓库生成成功'));
                  if (successSource) {
                    displayContent = prefixSuccessLabel(displayContent || successSource);
                  } else if (!displayContent) {
                    displayContent = successMessage;
                  }
                }
              }

              if (!displayContent && finalContent) {
                displayContent = finalContent;
              }

              if (!displayContent && !thinkContent && (!statusLines || statusLines.length === 0)) {
                displayContent = isMultiAgentResponse ? successMessage : '';
              }

              if (displayContent) {
                const partialId = stoppedMessageIdRef.current;
                const assignedId = partialId || `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const assistantMessage = {
                  id: assignedId,
                  type: 'assistant',
                  content: displayContent,
                  timestamp: new Date(data.response?.timestamp || Date.now()),
                  role: data.response?.role || 'assistant',
                  agents: responseAgents,
                  team_type: responseTeamType,
                  hasFiles: Array.isArray(data.response?.files) && data.response.files.length > 0,
                  files: Array.isArray(data.response?.files)
                    ? data.response.files.map((f, idx) => ({
                        id: `f-${idx}-${Date.now()}`,
                        name: typeof f === 'string' ? f.split('/').pop() : 'file',
                        size: 0,
                        type: 'text/plain',
                        path: typeof f === 'string' ? f : ''
                      }))
                    : undefined,
                  thinkingContent: thinkContent || undefined
                };

                if (statusLines && statusLines.length > 0) {
                  assistantMessage.statusLines = statusLines;
                }

                setMessages(prevMessages => {
                  if (partialId) {
                    const targetIndex = prevMessages.findIndex(msg => msg.id === partialId);
                    if (targetIndex >= 0) {
                      const updated = [...prevMessages];
                      updated[targetIndex] = assistantMessage;
                      console.log('更新手动停止的临时消息为最终结果:', assistantMessage);
                      return updated;
                    }
                  }

                  const lastMessage = prevMessages[prevMessages.length - 1];
                  if (lastMessage && lastMessage.type === 'assistant' && (lastMessage.content || '').trim() === displayContent) {
                    return prevMessages;
                  }
                  console.log('流式消息已保存到历史:', assistantMessage);
                  return [...prevMessages, assistantMessage];
                });
              }

              setStreamingStatusLines([]);
              setStreamingMessage('');
              streamingRef.current = '';
              resetThinkingState();
              setIsStreaming(false);
              sessionModeRef.current = 'unknown';
              hasChatDeltaRef.current = false;
              stoppedMessageIdRef.current = null;
              lastOutputChunkRef.current = '';
              break;
            }

            case 'error':
              console.error('SSE错误:', data.content);
              setStreamingMessage(prev => prev + '\n错误: ' + data.content);
              break;

            case 'stopped': {
              const stopLabelRaw = typeof data.content === 'string' ? data.content.trim() : '';
              finalizeStop(stopLabelRaw);
              break;
            }
          }
        },
        onError: async (error) => {
          console.error('SSE流式处理错误:', error);
          try {
            const healthBase = metaGPTAPI.getBaseURL().replace(/\/$/, '');
            const health = await fetch(`${healthBase}/health`);
            if (!health.ok) throw new Error('后端健康检查失败');
          } catch (e) {}
          setError(`流式处理错误：${error.message}`);
          setIsLoading(false);
          setIsStreaming(false);
          setStreamingMessage('');
          setStreamingStatusLines([]);
          setCurrentAbortController(null);
          resetThinkingState();
          sessionModeRef.current = 'unknown';
          hasChatDeltaRef.current = false;

          // 添加错误消息
          const errorMessage = {
            id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'assistant',
            content: `抱歉，处理消息时出现错误：${error.message}。请检查网络连接或API配置。`,
            timestamp: new Date(),
            role: 'system',
            isError: true
          };
          setMessages(prev => [...prev, errorMessage]);
        },
        onComplete: () => {
          setIsLoading(false);
          setIsStreaming(false);
          setStreamingMessage('');
          streamingRef.current = '';
          setCurrentAbortController(null);
          resetThinkingState();
          sessionModeRef.current = 'unknown';
          hasChatDeltaRef.current = false;
        }
      });

    } catch (err) {
      console.error('发送消息失败:', err);
      setError('发送消息失败，请检查网络连接或API配置');
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingMessage('');
      setStreamingStatusLines([]);
      setCurrentAbortController(null);
      resetThinkingState();
      sessionModeRef.current = 'unknown';
      hasChatDeltaRef.current = false;

      // 添加错误消息
      const errorMessage = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'assistant',
        content: `抱歉，发送消息时出现错误：${err.message}。请检查网络连接或API配置。`,
        timestamp: new Date(),
        role: 'system',
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // 处理文件上传
  const handleFileUpload = (file) => {
    setUploadedFiles(prev => [...prev, file]);
  };

  // 处理文件移除
  const handleFileRemove = (file) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== file.id));
  };

  // 移除单个已上传文件
  const removeUploadedFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // 处理键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 复制消息内容
  const copyMessage = (content) => {
    navigator.clipboard.writeText(content);
  };

  // 下载 Workspace ZIP（第二个选项）
  const downloadWorkspaceZip = async () => {
    try {
  const apiRoot = metaGPTAPI.getApiRoot().replace(/\/$/, '');
  const response = await fetch(`${apiRoot}/workspace/download-zip`);
      if (!response.ok) {
        console.error('下载压缩包失败');
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = response.headers.get('content-disposition');
      let filename = 'workspace.zip';
      if (cd) {
        const m = cd.match(/filename="(.+)"/);
        if (m) filename = m[1];
      }
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('下载 Workspace ZIP 失败:', err);
    }
  };

  // 重新生成回复
  const regenerateResponse = async (messageIndex) => {
    const userMessage = messages[messageIndex - 1];
    if (!userMessage || userMessage.type !== 'user') return;

    setIsLoading(true);
    setError(null);

    try {
      await metaGPTAPI.sendMessageStream(userMessage.content, {
        selectedAgents: activeAgents,
        sessionId,
        onMessage: (data) => {
          if (data.type === 'final') {
            const newAssistantMessage = {
              id: Date.now(),
              type: 'assistant',
              content: data.content,
              timestamp: new Date(data.response.timestamp || Date.now()),
              role: data.response.role || 'assistant',
              agents: activeAgents
            };

            setMessages(prev => {
              const newMessages = [...prev];
              newMessages[messageIndex] = newAssistantMessage;
              return newMessages;
            });
          }
        },
        onError: (error) => {
          console.error('重新生成回复失败:', error);
          setError('重新生成回复失败');
        },
        onComplete: () => {
          setIsLoading(false);
        }
      });
    } catch (err) {
      console.error('重新生成回复失败:', err);
      setError('重新生成回复失败');
      setIsLoading(false);
    }
  };

  // 获取角色显示名称
  const getRoleName = (role, agents) => {
    if (role === 'system') return '系统';
    if (role === 'multi_agent' && agents) {
      const agentNames = {
        'product_manager': '产品经理',
        'architect': '架构师',
        'engineer': '工程师',
        'qa_engineer': '测试工程师',
        'project_manager': '项目经理',
        'data_interpreter': '数据解释器'
      };
      return agents.map(id => agentNames[id] || id).join(' + ');
    }
    return '智能助手';
  };

  return (
  <div className="flex flex-col h-full">
      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="ml-auto"
          >
            ×
          </Button>
        </div>
      )}
      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea 
          ref={scrollAreaRef} 
          className="h-full"
          style={{ 
            maxHeight: 'calc(100vh - 240px)',
            overflowY: 'auto',
            scrollBehavior: 'smooth'
          }}
        >
          <div className="p-6" style={{ minHeight: '100%' }}>
            {/* 消息列表 */}
            <div className="space-y-6 max-w-7xl mx-auto" style={{ paddingBottom: '24px' }}>
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  style={{ marginBottom: '20px' }}
                >
                  <div
                    className={`flex space-x-4 ${message.type === 'assistant' ? 'max-w-[85%]' : 'max-w-[95%]'} ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
                  >
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarFallback className={message.type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}>
                        {message.type === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-3">
                        <span className="text-base font-medium">
                          {message.type === 'user' ? '你' : getRoleName(message.role, message.agents)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <Card className={`p-5 ${message.type === 'user' ? 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100' : 'bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700'} ${message.isError ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800' : ''} shadow-sm`}>
                        {message.type === 'user' ? (
                          <SimpleUserInput content={message.content} />
                        ) : (
                          <MessageContent 
                            content={message.content} 
                            thinkingContent={message.thinkingContent}
                            files={message.files}
                            isError={message.isError}
                          />
                        )}

                        {message.type === 'assistant' && !message.isError && (
                          <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={downloadWorkspaceZip}
                              className="text-sm h-9 px-3 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                            >
                              <Archive className="w-4 h-4 mr-2" />
                              下载Workspace
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyMessage(message.content)}
                              className="text-sm h-9 px-3 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              复制
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => regenerateResponse(index)}
                              className="text-sm h-9 px-3 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                              disabled={isLoading}
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              重新生成
                            </Button>
                            {!isLoading && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowWorkspacePanel(true)}
                                className="text-sm h-9 px-3 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                              >
                                <Paperclip className="w-4 h-4 mr-2" />
                                查看文件
                              </Button>
                            )}
                          </div>
                        )}
                      </Card>
                    </div>
                  </div>
                </div>
              ))}

              {/* 流式消息显示 */}
              {(isStreaming || isThinkStreaming) && (
                <div style={{ marginBottom: '20px' }}>
                  <EnhancedStreamingMessage 
                    content={streamingMessage} 
                    statusLines={streamingStatusLines}
                    thinkingContent={thinkStreamingMessage}
                    isThinkingActive={isThinkStreaming}
                    isComplete={!(isStreaming || isThinkStreaming)}
                    sessionMode={sessionModeRef.current}
                  />
                </div>
              )}

              {/* Loading Message */}
              {isLoading && !isStreaming && (
                <div className="flex justify-start" style={{ marginBottom: '20px' }}>
                  <div className="flex space-x-4 max-w-[80%]">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-secondary">
                        <Bot className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <Card className="p-5 bg-white border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-base text-muted-foreground">团队正在协作思考...</span>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        {/* 文件上传区域 */}
        {showFileUpload && (
          <div className="mb-3">
            <FileUpload
              onFileUpload={handleFileUpload}
              onFileRemove={handleFileRemove}
              maxFiles={5}
              maxSize={10 * 1024 * 1024} // 10MB
            />
          </div>
        )}

        {/* 已上传文件显示 */}
        {uploadedFiles.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="flex items-center space-x-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded text-xs">
                  <Paperclip className="w-3 h-3" />
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <button
                    onClick={() => removeUploadedFile(file.id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 输入框和按钮 */}
        <div className="flex space-x-2 items-end">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的项目需求..."
              className="min-h-[48px] max-h-[120px] resize-none text-sm"
              disabled={isLoading}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { const v = !showFileUpload; setShowFileUpload(v); if (v) setFilePickerTrigger(Date.now()); }}
            className="h-[48px] px-3"
            title="上传文件"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button
            onClick={isStreaming ? handleStop : handleSend}
            disabled={(!input.trim() && uploadedFiles.length === 0 && !isStreaming) || (isLoading && !isStreaming)}
            size="sm"
            className="h-[48px] px-4"
            variant={isStreaming ? "destructive" : "default"}
          >
            {isStreaming ? (
              <>
                <Square className="w-4 h-4 mr-1" />
                停止
              </>
            ) : isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                处理中
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-1" />
                发送
              </>
            )}
          </Button>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Enter 发送 | Shift+Enter 换行
        </div>
      </div>

      {/* Workspace文件面板 */}
      <WorkspaceFilePanel
        isVisible={showWorkspacePanel}
        onClose={() => setShowWorkspacePanel(false)}
        sessionId={sessionId}
      />
      {/* FileUpload 组件在上面 Input 区域内渲染，此处不需要 */}
    </div>
  );
};

export default ChatInterfaceStream;
