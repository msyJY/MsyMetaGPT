import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Key, 
  Palette, 
  Bell, 
  Download, 
  Upload,
  Save,
  RotateCcw,
  Moon,
  Sun,
  Monitor
} from 'lucide-react';

const SettingsPanel = () => {
  const [settings, setSettings] = useState({
    // API设置
    apiKey: '',
    apiBase: 'https://api.openai.com/v1',
    model: 'gpt-4-turbo',
    temperature: 0.7,
    maxTokens: 4000,
    
    // 界面设置
    theme: 'system',
    language: 'zh-CN',
    fontSize: 'medium',
    
    // 通知设置
    enableNotifications: true,
    soundEnabled: true,
    
    // 高级设置
    autoSave: true,
    maxHistoryItems: 100,
    enableCodeHighlight: true,
    enableMarkdownPreview: true
  });

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    // 保存设置到本地存储
    localStorage.setItem('metagpt-settings', JSON.stringify(settings));
    // 显示保存成功提示
    console.log('设置已保存');
  };

  const handleReset = () => {
    // 重置为默认设置
    setSettings({
      apiKey: '',
      apiBase: 'https://api.openai.com/v1',
      model: 'gpt-4-turbo',
      temperature: 0.7,
      maxTokens: 4000,
      theme: 'system',
      language: 'zh-CN',
      fontSize: 'medium',
      enableNotifications: true,
      soundEnabled: true,
      autoSave: true,
      maxHistoryItems: 100,
      enableCodeHighlight: true,
      enableMarkdownPreview: true
    });
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'metagpt-settings.json';
    link.click();
  };

  const importSettings = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target.result);
          setSettings(importedSettings);
        } catch (error) {
          console.error('导入设置失败:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">设置</h2>
        <p className="text-muted-foreground">
          配置MetaGPT WebUI的各项参数和偏好设置
        </p>
      </div>

      <Tabs defaultValue="api" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="api">API配置</TabsTrigger>
          <TabsTrigger value="interface">界面设置</TabsTrigger>
          <TabsTrigger value="notifications">通知设置</TabsTrigger>
          <TabsTrigger value="advanced">高级设置</TabsTrigger>
        </TabsList>

        {/* API配置 */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="w-5 h-5" />
                <span>OpenAI API配置</span>
              </CardTitle>
              <CardDescription>
                配置OpenAI API密钥和相关参数
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API密钥</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={settings.apiKey}
                  onChange={(e) => handleSettingChange('apiKey', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="apiBase">API基础URL</Label>
                <Input
                  id="apiBase"
                  placeholder="https://api.openai.com/v1"
                  value={settings.apiBase}
                  onChange={(e) => handleSettingChange('apiBase', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">模型选择</Label>
                <Select value={settings.model} onValueChange={(value) => handleSettingChange('model', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">温度 ({settings.temperature})</Label>
                  <Input
                    id="temperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) => handleSettingChange('temperature', parseFloat(e.target.value))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxTokens">最大Token数</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    min="100"
                    max="8000"
                    value={settings.maxTokens}
                    onChange={(e) => handleSettingChange('maxTokens', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 界面设置 */}
        <TabsContent value="interface" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="w-5 h-5" />
                <span>外观设置</span>
              </CardTitle>
              <CardDescription>
                自定义界面外观和显示偏好
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>主题模式</Label>
                <Select value={settings.theme} onValueChange={(value) => handleSettingChange('theme', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center space-x-2">
                        <Sun className="w-4 h-4" />
                        <span>浅色模式</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center space-x-2">
                        <Moon className="w-4 h-4" />
                        <span>深色模式</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center space-x-2">
                        <Monitor className="w-4 h-4" />
                        <span>跟随系统</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>语言</Label>
                <Select value={settings.language} onValueChange={(value) => handleSettingChange('language', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-CN">简体中文</SelectItem>
                    <SelectItem value="en-US">English</SelectItem>
                    <SelectItem value="ja-JP">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>字体大小</Label>
                <Select value={settings.fontSize} onValueChange={(value) => handleSettingChange('fontSize', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">小</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="large">大</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 通知设置 */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>通知设置</span>
              </CardTitle>
              <CardDescription>
                管理通知和提醒设置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>启用通知</Label>
                  <p className="text-sm text-muted-foreground">
                    接收项目完成和重要事件的通知
                  </p>
                </div>
                <Switch
                  checked={settings.enableNotifications}
                  onCheckedChange={(checked) => handleSettingChange('enableNotifications', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>声音提醒</Label>
                  <p className="text-sm text-muted-foreground">
                    播放声音提醒新消息
                  </p>
                </div>
                <Switch
                  checked={settings.soundEnabled}
                  onCheckedChange={(checked) => handleSettingChange('soundEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 高级设置 */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>高级设置</span>
              </CardTitle>
              <CardDescription>
                高级功能和性能设置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>自动保存</Label>
                  <p className="text-sm text-muted-foreground">
                    自动保存对话历史和设置
                  </p>
                </div>
                <Switch
                  checked={settings.autoSave}
                  onCheckedChange={(checked) => handleSettingChange('autoSave', checked)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="maxHistory">最大历史记录数</Label>
                <Input
                  id="maxHistory"
                  type="number"
                  min="10"
                  max="1000"
                  value={settings.maxHistoryItems}
                  onChange={(e) => handleSettingChange('maxHistoryItems', parseInt(e.target.value))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>代码高亮</Label>
                  <p className="text-sm text-muted-foreground">
                    启用代码语法高亮显示
                  </p>
                </div>
                <Switch
                  checked={settings.enableCodeHighlight}
                  onCheckedChange={(checked) => handleSettingChange('enableCodeHighlight', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Markdown预览</Label>
                  <p className="text-sm text-muted-foreground">
                    启用Markdown格式预览
                  </p>
                </div>
                <Switch
                  checked={settings.enableMarkdownPreview}
                  onCheckedChange={(checked) => handleSettingChange('enableMarkdownPreview', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* 数据管理 */}
          <Card>
            <CardHeader>
              <CardTitle>数据管理</CardTitle>
              <CardDescription>
                导入导出设置和清理数据
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
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
                  style={{ display: 'none' }}
                  onChange={importSettings}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 操作按钮 */}
      <div className="flex justify-end space-x-2 mt-6 pt-6 border-t">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          重置
        </Button>
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          保存设置
        </Button>
      </div>
    </div>
  );
};

export default SettingsPanel;

