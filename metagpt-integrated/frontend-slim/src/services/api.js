// MetaGPT WebUI API Service
// 集成新的MetaGPT后端服务

class MetaGPTAPIService {
  constructor() {
    const explicit = (import.meta?.env?.VITE_BACKEND_URL
      || (typeof window !== 'undefined' && window.__METAGPT_BACKEND_URL)
      || '').trim();

  const normalized = (explicit || 'http://127.0.0.1:5001').replace(/\/$/, '');
    const hasMetagpt = /\/api\/metagpt\/?$/i.test(normalized);

    this.baseURL = hasMetagpt ? normalized : `${normalized}/api/metagpt`;
    this.apiRoot = this.baseURL.replace(/\/metagpt$/i, '');
    this.timeout = 30000;
    this.retryAttempts = 3;
  }

  getBaseURL() {
    return this.baseURL;
  }

  getApiRoot() {
    return this.apiRoot;
  }

  // 通用请求方法
  async request(endpoint, options = {}) {
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      timeout: this.timeout,
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    let lastError;
    const url = `${this.baseURL}${endpoint}`;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...config,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        lastError = error;
        if (attempt < this.retryAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError;
  }

  // 健康检查
  async testConnection() {
    try {
      const response = await this.request('/health');
      return { success: true, message: '连接成功', data: response };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // 发送聊天消息
  async sendMessage(message, options = {}) {
    try {
      const { selectedAgents = [], stream = false, files = [] } = options;

      const response = await this.request('/chat', {
        method: 'POST',
        body: {
          message,
          agents: selectedAgents,
          files, // 允许传入 Jupyter 文件路径列表
          team_type: options.team_type || 'default',
          timestamp: new Date().toISOString(),
        },
      });
      return response;
    } catch (error) {
      throw new Error(`发送消息失败: ${error.message}`);
    }
  }

  // SSE流式发送消息
  async sendMessageStream(message, options = {}) {
    const { selectedAgents = [], onMessage, onError, onComplete, sessionId } = options;
    const intent = (options.intent || 'auto'); // chat | model | auto

    // 优先使用外部传来的 signal；否则内部创建一个 AbortController，并通过回调暴露给调用方
    let abortController = null;
    let signal = options.signal;
    if (!signal) {
      abortController = new AbortController();
      signal = abortController.signal;
    if (options.setAbortController) {
      options.setAbortController(abortController);
    }
    }
    const requestBody = JSON.stringify({
      message,
      session_id: sessionId,
      agents: selectedAgents,
      intent,
      files: options.files || [], // 由前端传入的 Jupyter 文件路径
      timestamp: new Date().toISOString(),
    });

    try {
      const response = await fetch(`${this.baseURL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        body: requestBody,
        signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const decoder = new TextDecoder();
      let buffer = '';

      const handleEventObject = (payload) => {
        if (!payload || typeof payload !== 'object') {
          return false;
        }

        switch (payload.type) {
          case 'start':
            if (onMessage) {
              onMessage({
                type: 'start',
                sessionId: payload.session_id,
                content: '开始处理...'
              });
            }
            break;

          case 'output':
            if (onMessage) {
              onMessage({
                type: 'output',
                content: payload.content,
                isStreaming: true
              });
            }
            break;

          case 'chat_delta':
            if (onMessage) {
              onMessage({
                type: 'chat_delta',
                content: payload.content,
                isStreaming: true
              });
            }
            break;

          case 'chat_think_start':
            onMessage?.({ type: 'chat_think_start' });
            break;

          case 'chat_think_delta':
            if (onMessage) {
              onMessage({
                type: 'chat_think_delta',
                content: payload.content,
                isStreaming: true
              });
            }
            break;

          case 'chat_think_end':
            onMessage?.({ type: 'chat_think_end' });
            break;

          case 'final':
            if (onMessage) {
              onMessage({
                type: 'final',
                content: payload.response?.content,
                response: payload.response,
                isStreaming: false
              });
            }
            break;

          case 'error':
            if (onError) {
              onError(new Error(payload.content));
            }
            break;

          case 'stopped':
            if (onMessage) {
              onMessage({ type: 'stopped', content: '处理已停止' });
            }
            onComplete?.();
            return true;

          case 'end':
            onComplete?.();
            return true;

          case 'heartbeat':
            onMessage?.({ type: 'heartbeat' });
            break;

          default:
            break;
        }

        return false;
      };

      const processRawEvent = (rawEvent) => {
        if (!rawEvent) {
          return false;
        }

        const lines = rawEvent.split('\n');
        const dataLines = [];

        for (const line of lines) {
          if (!line) continue;
          const withoutCR = line.endsWith('\r') ? line.slice(0, -1) : line;
          const trimmedPrefix = withoutCR.trimStart();

          if (trimmedPrefix.startsWith('data:')) {
            const prefixIndex = withoutCR.indexOf('data:');
            const rawValue = withoutCR.slice(prefixIndex + 5); // 保留原始空格
            const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
            dataLines.push(value);
          }
        }

        if (!dataLines.length) {
          return false;
        }

        try {
          const parsed = JSON.parse(dataLines.join('\n'));
          return handleEventObject(parsed);
        } catch (parseError) {
          console.warn('解析SSE数据失败:', parseError, dataLines.join('\\n'));
          return false;
        }
      };

      const reader = response.body?.getReader();
      if (!reader) {
        // 回退：如果浏览器不支持流式读取，则一次性读取并按事件解析
        const fallbackText = await response.text();
        if (fallbackText) {
          const events = fallbackText.split(/\n\n+/);
          for (const eventChunk of events) {
            if (processRawEvent(eventChunk.trim())) {
              break;
            }
          }
        }
        onComplete?.();
        return;
      }

      const locateDelimiter = (text) => {
        const crlfIndex = text.indexOf('\r\n\r\n');
        const lfIndex = text.indexOf('\n\n');
        if (crlfIndex === -1) return lfIndex;
        if (lfIndex === -1) return crlfIndex;
        return Math.min(crlfIndex, lfIndex);
      };

      const delimiterLengthAt = (text, index) => {
        if (index === -1) return 0;
        if (text.startsWith('\r\n\r\n', index)) {
          return 4;
        }
        if (text.startsWith('\n\n', index)) {
          return 2;
        }
        return 0;
      };

      const processBuffer = (isFinal = false) => {
        let boundaryIndex = locateDelimiter(buffer);
        while (boundaryIndex !== -1) {
          const rawEvent = buffer.slice(0, boundaryIndex);
          const delimiterLength = delimiterLengthAt(buffer, boundaryIndex) || 2;
          buffer = buffer.slice(boundaryIndex + delimiterLength);
          const stop = processRawEvent(rawEvent);
          if (stop) {
            return true;
          }
          boundaryIndex = locateDelimiter(buffer);
        }

        if (isFinal && buffer.trim()) {
          const stop = processRawEvent(buffer);
          buffer = '';
          if (stop) {
            return true;
          }
        }

        return false;
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            processBuffer(true);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const shouldStop = processBuffer();
          if (shouldStop) {
            break;
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (onComplete) {
        onComplete();
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        if (onMessage) {
          onMessage({
            type: 'stopped',
            content: '用户停止了处理'
          });
        }
        if (onComplete) {
          onComplete();
        }
        return;
      }

      if (onError) {
        onError(error);
      }
      throw error;
    }
  }

  // 停止处理
  async stopProcessing(sessionId) {
    try {
      const response = await this.request(`/stop/${sessionId}`, {
        method: 'POST'
      });
      return response;
    } catch (error) {
      throw new Error(`停止处理失败: ${error.message}`);
    }
  }

  // 上传本地文件到 workspace（容器内）
  async uploadToWorkspace(file, { sessionId } = {}) {
    const q = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
    const apiRoot = this.getApiRoot().replace(/\/$/, '');
    const url = `${apiRoot}/workspace/upload${q}`;

    const form = new FormData();
    form.append('file', file);

    const resp = await fetch(url, {
      method: 'POST',
      body: form
    });
    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${resp.status}`);
    }
    return await resp.json();
  }

  // 获取项目列表
  async getProjects() {
    try {
      const response = await this.request('/projects');
      return response;
    } catch (error) {
      throw new Error(`获取项目列表失败: ${error.message}`);
    }
  }

  // 获取项目详情
  async getProject(projectName) {
    try {
      const response = await this.request(`/projects/${projectName}`);
      return response;
    } catch (error) {
      throw new Error(`获取项目详情失败: ${error.message}`);
    }
  }

  // 获取LLM配置
  async getConfig() {
    try {
      const response = await this.request('/config');
      return response;
    } catch (error) {
      throw new Error(`获取配置失败: ${error.message}`);
    }
  }

  // 更新LLM配置
  async updateConfig(config) {
    try {
      const response = await this.request('/config', {
        method: 'POST',
        body: config,
      });
      return response;
    } catch (error) {
      throw new Error(`更新配置失败: ${error.message}`);
    }
  }

  // 测试LLM连接
  async testLLMConnection(config) {
    try {
      const response = await this.request('/test-connection', {
        method: 'POST',
        body: config,
      });
      return response;
    } catch (error) {
      throw new Error(`测试连接失败: ${error.message}`);
    }
  }

  // 兼容旧接口的方法
   async getChatHistory(page = 1, limit = 20) {
    try {
      const response = await this.request(`/chat-history?page=${page}&limit=${limit}`);
      return response;
    } catch (error) {
      throw new Error(`获取聊天历史失败: ${error.message}`);
    }
  }

  async searchChatHistory(query, dateRange = null) {
    try {
      let url = `/chat-history?page=1&limit=50`;
      if (query) {
        url += `&search=${encodeURIComponent(query)}`;
      }
      if (dateRange) {
        url += `&date_range=${dateRange}`;
      }
      const response = await this.request(url);
      return response;
    } catch (error) {
      throw new Error(`搜索聊天历史失败: ${error.message}`);
    }
  }

  async deleteChatHistory(chatId) {
    // 暂时返回成功，后续可以实现
    return { success: true };
  }

  async uploadFile(file) {
    // 暂时返回模拟数据，后续可以实现文件上传
    return {
      success: true,
      data: {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file)
      }
    };
  }

  // 项目管理相关方法（兼容旧接口）
  async createProject(projectData) {
    // 通过聊天接口创建项目
    return this.sendMessage(projectData.description || projectData.name);
  }

  async updateProject(projectId, projectData) {
    return { success: true, message: '项目更新成功' };
  }

  async deleteProject(projectId) {
    try {
      const response = await this.request(`/projects/${projectId}`, {
        method: 'DELETE'
      });
      return response;
    } catch (error) {
      throw new Error(`删除项目失败: ${error.message}`);
    }
  }

  async getProjectFiles(projectId) {
    try {
      const project = await this.getProject(projectId);
      return {
        success: true,
        data: project.project?.files || {}
      };
    } catch (error) {
      throw new Error(`获取项目文件失败: ${error.message}`);
    }
  }

  // 智能体配置相关方法（兼容旧接口）
  async getAgentConfig() {
    return {
      success: true,
      data: {
        agents: [
          { id: 'product_manager', name: '产品经理', enabled: true },
          { id: 'architect', name: '架构师', enabled: true },
          { id: 'engineer', name: '工程师', enabled: true },
          { id: 'project_manager', name: '项目经理', enabled: true },
          { id: 'qa_engineer', name: '测试工程师', enabled: true },
          { id: 'team_leader', name: '团队负责人', enabled: true },
        ]
      }
    };
  }

  async updateAgentConfig(config) {
    return { success: true, message: '智能体配置更新成功' };
  }
}

// 大模型API服务 - 通过后端MetaGPT服务管理
class LLMAPIService {
  constructor() {
    this.metaGPTAPI = new MetaGPTAPIService();
  }

  // 加载配置
  async loadConfig() {
    try {
      const response = await this.metaGPTAPI.getConfig();
      if (response.success) {
        this.config = response.config || {};
      } else {
        this.config = this.getDefaultConfig();
      }
      return this.config;
    } catch (error) {
      console.error('加载配置失败:', error);
      this.config = this.getDefaultConfig();
      return this.config;
    }
  }

  // 获取默认配置（硬编码）
  getDefaultConfig() {
    return {
      api_type: 'openai',
      model: 'qwen2.5-32b-instruct',
      base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      api_key: 'sk-61ad871dec3d438283a5905564b4f440',
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
    };
  }

  // 更新配置
  async updateConfig(newConfig) {
    try {
      const response = await this.metaGPTAPI.updateConfig(newConfig);
      if (response.success) {
        this.config = { ...this.config, ...newConfig };
      }
      return response;
    } catch (error) {
      console.error('更新配置失败:', error);
      throw error;
    }
  }

  // 测试模型配置
  async testModel(config = null) {
    try {
      const testConfig = config || this.config;
      const response = await this.metaGPTAPI.testLLMConnection(testConfig);
      return response;
    } catch (error) {
      return {
        success: false,
        message: `模型测试失败: ${error.message}`,
      };
    }
  }

  // 发送消息到大模型（通过后端）
  async sendMessage(message) {
    try {
      const response = await this.metaGPTAPI.sendMessage(message);
      return {
        success: response.success,
        content: response.message || response.code || '',
        data: response,
      };
    } catch (error) {
      throw new Error(`大模型请求失败: ${error.message}`);
    }
  }
}

// 导出API实例
export const metaGPTAPI = new MetaGPTAPIService();
export const llmAPI = new LLMAPIService();

