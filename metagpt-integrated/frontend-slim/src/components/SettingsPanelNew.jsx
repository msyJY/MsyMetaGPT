import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  TestTube, 
  Key, 
  Globe, 
  Palette, 
  Bell,
  Shield,
  Download,
  Upload,
  Trash2,
  Plus,
  Check,
  X,
  AlertCircle,
  Info
} from 'lucide-react';
import { metaGPTAPI, llmAPI } from '../services/api';

const SettingsPanelNew = () => {
  const [settings, setSettings] = useState({
    api: {
      baseURL: 'http://localhost:5002/api/metagpt',
      apiKey: '',
      timeout: 30000,
      retryAttempts: 3
    },
    model: {
      api_type: 'openai',
      model: 'gpt-4-turbo',
      base_url: 'https://api.openai.com/v1',
      api_key: '',
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0
    },
    agents: {
      defaultAgents: ['product_manager', 'architect', 'engineer'],
      maxConcurrentAgents: 5,
      agentTimeout: 60000
    },
    ui: {
      theme: 'system',
      language: 'zh-CN',
      fontSize: 'medium',
      enableAnimations: true,
      compactMode: false
    },
    notifications: {
      enableDesktop: true,
      enableSound: false,
      enableEmail: false,
      emailAddress: ''
    },
    advanced: {
      enableDebugMode: false,
      logLevel: 'info',
      enableTelemetry: true,
      autoSave: true,
      autoSaveInterval: 30000
    }
  });

  const [testResults, setTestResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 加载设置
  useEffect(() => {
    loadSettings();
  }, []);

  // 监听设置变化
  useEffect(() => {
    setHasChanges(true);
  }, [settings]);

  const loadSettings = async () => {
    try {
      // 从后端加载LLM配置
      const response = await metaGPTAPI.getConfig();
      if (response.success && response.config) {
        setSettings(prev => ({
          ...prev,
          model: {
            ...prev.model,
            ...response.config
          }
        }));
      }
      
      // 从本地存储加载其他设置
      const savedSettings = localStorage.getItem('metagpt-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ 
          ...prev, 
          ...parsed,
          model: response.success && response.config ? { ...prev.model, ...response.config } : prev.model
        }));
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      
      // 保存LLM配置到后端
      const response = await metaGPTAPI.updateConfig(settings.model);
      if (!response.success) {
        throw new Error(response.message || '保存LLM配置失败');
      }
      
      // 保存其他设置到本地存储
      localStorage.setItem('metagpt-settings', JSON.stringify(settings));
      setHasChanges(false);
      alert('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      alert(`保存设置失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetSettings = () => {
    if (window.confirm('确定要重置所有设置吗？此操作不可恢复。')) {
      localStorage.removeItem('metagpt-settings');
      window.location.reload();
    }
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'metagpt-settings.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target.result);
          setSettings(prev => ({ ...prev, ...importedSettings }));
          alert('设置导入成功');
        } catch (error) {
          alert('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setTestResults(prev => ({ ...prev, api: null }));
    
    try {
      const response = await metaGPTAPI.testConnection();
      setTestResults(prev => ({ 
        ...prev, 
        api: response
      }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        api: { success: false, message: `连接失败: ${error.message}` }
      }));
    } finally {
      setLoading(false);
    }
  };

  const testModelConfiguration = async () => {
    setLoading(true);
    setTestResults(prev => ({ ...prev, model: null }));
    
    try {
      const response = await metaGPTAPI.testLLMConnection(settings.model);
      setTestResults(prev => ({ 
        ...prev, 
        model: response
      }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        model: { success: false, message: `测试失败: ${error.message}` }
      }));
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const modelProviders = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'google', label: 'Google' },
    { value: 'azure', label: 'Azure OpenAI' },
    { value: 'local', label: '本地模型' }
  ];

  const availableModels = {
    openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    google: ['gemini-pro', 'gemini-pro-vision'],
    azure: ['gpt-4', 'gpt-35-turbo'],
    local: ['qwen2.5-32b-instruct', 'codellama', 'mistral']
  };

  const themes = [
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
    { value: 'system', label: '跟随系统' }
  ];

  const languages = [
    { value: 'zh-CN', label: '简体中文' },
    { value: 'en-US', label: 'English' },
    { value: 'ja-JP', label: '日本語' }
  ];

  const fontSizes = [
    { value: 'small', label: '小' },
    { value: 'medium', label: '中' },
    { value: 'large', label: '大' }
  ];

  const logLevels = [
    { value: 'debug', label: 'Debug' },
    { value: 'info', label: 'Info' },
    { value: 'warn', label: 'Warning' },
    { value: 'error', label: 'Error' }
  ];

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">设置</h1>
            <p className="text-muted-foreground">配置MetaGPT的各项参数</p>
          </div>
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <Badge variant="outline" className="text-orange-600">
                有未保存的更改
              </Badge>
            )}
            <Button variant="outline" onClick={resetSettings}>
              <RefreshCw className="w-4 h-4 mr-2" />
              重置
            </Button>
            <Button onClick={saveSettings} disabled={!hasChanges}>
              <Save className="w-4 h-4 mr-2" />
              保存设置
            </Button>
          </div>
        </div>
      </div>

      {/* 设置内容 */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="api" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-6 mx-6">
            <TabsTrigger value="api">API配置</TabsTrigger>
            <TabsTrigger value="model">模型设置</TabsTrigger>
            <TabsTrigger value="agents">智能体</TabsTrigger>
            <TabsTrigger value="ui">界面</TabsTrigger>
            <TabsTrigger value="notifications">通知</TabsTrigger>
            <TabsTrigger value="advanced">高级</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden px-6">
            <ScrollArea className="h-full">
              <div className="py-6">
                <TabsContent value="api" className="space-y-6 mt-0">
                  <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Globe className="w-5 h-5" />
                    <span>API连接配置</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="baseUrl">API基础URL</Label>
                      <Input
                        id="baseUrl"
                        value={settings.api.baseURL}
                        onChange={(e) => updateSetting('api', 'baseURL', e.target.value)}
                        placeholder="http://localhost:8000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="apiKey">API密钥</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        value={settings.api.apiKey}
                        onChange={(e) => updateSetting('api', 'apiKey', e.target.value)}
                        placeholder="输入API密钥"
                      />
                    </div>
                                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="timeout">超时时间 (毫秒)</Label>
                      <Input
                        id="timeout"
                        type="number"
                        value={settings.api.timeout}
                        onChange={(e) => updateSetting('api', 'timeout', parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="retryAttempts">重试次数</Label>
                      <Input
                        id="retryAttempts"
                        type="number"
                        value={settings.api.retryAttempts}
                        onChange={(e) => updateSetting('api', 'retryAttempts', parseInt(e.target.value))}
                      />
                    </div>
                  </div>

                  <Button onClick={testConnection} disabled={loading}>
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        测试中...
                      </>
                    ) : (
                      '测试连接'
                    )}
                  </Button>

                  {testResults.api && (
                    <div className={`flex items-center space-x-2 ${testResults.api.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testResults.api.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        <span className="text-sm">{testResults.api.message}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
                </TabsContent>

                <TabsContent value="model" className="space-y-6 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>模型配置</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="api_type">API类型</Label>
                      <Select
                        value={settings.model.api_type}
                        onValueChange={(value) => updateSetting('model', 'api_type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {modelProviders.map(provider => (
                            <SelectItem key={provider.value} value={provider.value}>
                              {provider.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="model">模型</Label>
                      <div className="space-y-2">
                        <Select
                          value={settings.model.model}
                          onValueChange={(value) => updateSetting('model', 'model', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择预设模型或输入自定义模型" />
                          </SelectTrigger>
                          <SelectContent>
                            {(availableModels[settings.model.api_type] || []).map(model => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="base_url">API Base URL</Label>
                      <Input
                        id="base_url"
                        value={settings.model.base_url}
                        onChange={(e) => updateSetting('model', 'base_url', e.target.value)}
                        placeholder="https://api.openai.com/v1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="api_key">API Key</Label>
                      <Input
                        id="api_key"
                        type="password"
                        value={settings.model.api_key}
                        onChange={(e) => updateSetting('model', 'api_key', e.target.value)}
                        placeholder="输入您的API密钥"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="temperature">温度 (0-2)</Label>
                      <Input
                        id="temperature"
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={settings.model.temperature}
                        onChange={(e) => updateSetting('model', 'temperature', parseFloat(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="max_tokens">最大令牌数</Label>
                      <Input
                        id="max_tokens"
                        type="number"
                        value={settings.model.max_tokens}
                        onChange={(e) => updateSetting('model', 'max_tokens', parseInt(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="top_p">Top P (0-1)</Label>
                      <Input
                        id="top_p"
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.model.top_p}
                        onChange={(e) => updateSetting('model', 'top_p', parseFloat(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="frequency_penalty">频率惩罚 (-2 to 2)</Label>
                      <Input
                        id="frequency_penalty"
                        type="number"
                        min="-2"
                        max="2"
                        step="0.1"
                        value={settings.model.frequency_penalty}
                        onChange={(e) => updateSetting('model', 'frequency_penalty', parseFloat(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="presence_penalty">存在惩罚 (-2 to 2)</Label>
                    <Input
                      id="presence_penalty"
                      type="number"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={settings.model.presence_penalty}
                      onChange={(e) => updateSetting('model', 'presence_penalty', parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button onClick={testModelConfiguration} disabled={loading}>
                      <TestTube className="w-4 h-4 mr-2" />
                      测试模型配置
                    </Button>
                    {testResults.model && (
                      <div className={`flex items-center space-x-2 ${testResults.model.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testResults.model.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        <span className="text-sm">{testResults.model.message}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
                </TabsContent>

                <TabsContent value="agents" className="space-y-6 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>智能体配置</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="maxConcurrentAgents">最大并发智能体数量</Label>
                    <Input
                      id="maxConcurrentAgents"
                      type="number"
                      min="1"
                      max="10"
                      value={settings.agents.maxConcurrentAgents}
                      onChange={(e) => updateSetting('agents', 'maxConcurrentAgents', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="agentTimeout">智能体超时时间 (毫秒)</Label>
                    <Input
                      id="agentTimeout"
                      type="number"
                      value={settings.agents.agentTimeout}
                      onChange={(e) => updateSetting('agents', 'agentTimeout', parseInt(e.target.value))}
                    />
                  </div>
                </CardContent>
              </Card>
                </TabsContent>

                <TabsContent value="ui" className="space-y-6 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Palette className="w-5 h-5" />
                    <span>界面设置</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="theme">主题</Label>
                      <Select
                        value={settings.ui.theme}
                        onValueChange={(value) => updateSetting('ui', 'theme', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {themes.map(theme => (
                            <SelectItem key={theme.value} value={theme.value}>
                              {theme.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="language">语言</Label>
                      <Select
                        value={settings.ui.language}
                        onValueChange={(value) => updateSetting('ui', 'language', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.map(lang => (
                            <SelectItem key={lang.value} value={lang.value}>
                              {lang.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="fontSize">字体大小</Label>
                    <Select
                      value={settings.ui.fontSize}
                      onValueChange={(value) => updateSetting('ui', 'fontSize', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fontSizes.map(size => (
                          <SelectItem key={size.value} value={size.value}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="enableAnimations"
                        checked={settings.ui.enableAnimations}
                        onCheckedChange={(checked) => updateSetting('ui', 'enableAnimations', checked)}
                      />
                      <Label htmlFor="enableAnimations">启用动画效果</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="compactMode"
                        checked={settings.ui.compactMode}
                        onCheckedChange={(checked) => updateSetting('ui', 'compactMode', checked)}
                      />
                      <Label htmlFor="compactMode">紧凑模式</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
                </TabsContent>

                <TabsContent value="notifications" className="space-y-6 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Bell className="w-5 h-5" />
                    <span>通知设置</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="enableDesktop"
                        checked={settings.notifications.enableDesktop}
                        onCheckedChange={(checked) => updateSetting('notifications', 'enableDesktop', checked)}
                      />
                      <Label htmlFor="enableDesktop">启用桌面通知</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="enableSound"
                        checked={settings.notifications.enableSound}
                        onCheckedChange={(checked) => updateSetting('notifications', 'enableSound', checked)}
                      />
                      <Label htmlFor="enableSound">启用声音提醒</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="enableEmail"
                        checked={settings.notifications.enableEmail}
                        onCheckedChange={(checked) => updateSetting('notifications', 'enableEmail', checked)}
                      />
                      <Label htmlFor="enableEmail">启用邮件通知</Label>
                    </div>
                  </div>

                  {settings.notifications.enableEmail && (
                    <div>
                      <Label htmlFor="emailAddress">邮箱地址</Label>
                      <Input
                        id="emailAddress"
                        type="email"
                        value={settings.notifications.emailAddress}
                        onChange={(e) => updateSetting('notifications', 'emailAddress', e.target.value)}
                        placeholder="输入邮箱地址"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-6 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="w-5 h-5" />
                    <span>高级设置</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="enableDebugMode"
                        checked={settings.advanced.enableDebugMode}
                        onCheckedChange={(checked) => updateSetting('advanced', 'enableDebugMode', checked)}
                      />
                      <Label htmlFor="enableDebugMode">启用调试模式</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="enableTelemetry"
                        checked={settings.advanced.enableTelemetry}
                        onCheckedChange={(checked) => updateSetting('advanced', 'enableTelemetry', checked)}
                      />
                      <Label htmlFor="enableTelemetry">启用遥测数据收集</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="autoSave"
                        checked={settings.advanced.autoSave}
                        onCheckedChange={(checked) => updateSetting('advanced', 'autoSave', checked)}
                      />
                      <Label htmlFor="autoSave">自动保存</Label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="logLevel">日志级别</Label>
                      <Select
                        value={settings.advanced.logLevel}
                        onValueChange={(value) => updateSetting('advanced', 'logLevel', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {logLevels.map(level => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="autoSaveInterval">自动保存间隔 (毫秒)</Label>
                      <Input
                        id="autoSaveInterval"
                        type="number"
                        value={settings.advanced.autoSaveInterval}
                        onChange={(e) => updateSetting('advanced', 'autoSaveInterval', parseInt(e.target.value))}
                        disabled={!settings.advanced.autoSave}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">数据管理</h4>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" onClick={exportSettings}>
                        <Download className="w-4 h-4 mr-2" />
                        导出设置
                      </Button>
                      <Button variant="outline" onClick={() => document.getElementById('import-settings').click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        导入设置
                      </Button>
                      <input
                        id="import-settings"
                        type="file"
                        accept=".json"
                        onChange={importSettings}
                        className="hidden"
                      />
                      <Button variant="outline" onClick={resetSettings} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        重置所有设置
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
                </TabsContent>
              </div>
            </ScrollArea>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPanelNew;

