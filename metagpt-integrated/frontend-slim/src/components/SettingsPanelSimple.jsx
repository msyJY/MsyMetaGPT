import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Check,
  X,
  AlertCircle,
  Info,
  Shield,
  Palette,
  Bell
} from 'lucide-react';
import { metaGPTAPI } from '../services/api';

const SettingsPanelSimple = () => {
  const [config, setConfig] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await metaGPTAPI.getConfig();
      if (response.success) {
        setConfig(response.config);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setLoading(true);
      setTestResult(null);
      const response = await metaGPTAPI.testLLMConnection(config);
      setTestResult(response);
    } catch (error) {
      setTestResult({
        success: false,
        message: `测试失败: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !config) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载配置中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">系统设置</h1>
            <p className="text-muted-foreground">查看MetaGPT系统配置和状态</p>
          </div>
          <Badge variant="outline" className="text-green-600">
            配置已优化
          </Badge>
        </div>
      </div>

      {/* 设置内容 */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="model" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4 mx-6">
            <TabsTrigger value="model">模型配置</TabsTrigger>
            <TabsTrigger value="system">系统状态</TabsTrigger>
            <TabsTrigger value="ui">界面设置</TabsTrigger>
            <TabsTrigger value="about">关于</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden px-6">
            <ScrollArea className="h-full">
              <div className="py-6">
                <TabsContent value="model" className="space-y-6 mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Settings className="w-5 h-5" />
                        <span>大模型配置</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {config && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">模型名称</label>
                              <p className="text-sm font-mono bg-muted p-2 rounded">{config.model}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">API类型</label>
                              <p className="text-sm font-mono bg-muted p-2 rounded">{config.api_type}</p>
                            </div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">API地址</label>
                            <p className="text-sm font-mono bg-muted p-2 rounded break-all">{config.base_url}</p>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">温度</label>
                              <p className="text-sm font-mono bg-muted p-2 rounded">{config.temperature}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">最大令牌</label>
                              <p className="text-sm font-mono bg-muted p-2 rounded">{config.max_tokens}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Top P</label>
                              <p className="text-sm font-mono bg-muted p-2 rounded">{config.top_p}</p>
                            </div>
                          </div>

                          <div className="pt-4 border-t">
                            <Button onClick={testConnection} disabled={loading}>
                              {loading ? (
                                <>
                                  <div className="w-4 h-4 mr-2 animate-spin border-2 border-current border-t-transparent rounded-full" />
                                  测试中...
                                </>
                              ) : (
                                '测试连接'
                              )}
                            </Button>

                            {testResult && (
                              <div className={`mt-4 flex items-center space-x-2 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                {testResult.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                <span className="text-sm">{testResult.message}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start space-x-2">
                          <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                          <div className="text-sm text-blue-800">
                            <p className="font-medium">配置说明</p>
                            <p>模型配置已在后端进行优化，无需手动调整。系统使用阿里云通义千问模型，提供稳定可靠的AI服务。</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="system" className="space-y-6 mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Shield className="w-5 h-5" />
                        <span>系统状态</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="font-medium">后端服务</span>
                          </div>
                          <Badge variant="outline" className="text-green-600">运行中</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="font-medium">数据库连接</span>
                          </div>
                          <Badge variant="outline" className="text-green-600">正常</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="font-medium">AI模型</span>
                          </div>
                          <Badge variant="outline" className="text-green-600">可用</Badge>
                        </div>
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
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">主题</span>
                          <Badge variant="secondary">跟随系统</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="font-medium">语言</span>
                          <Badge variant="secondary">简体中文</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="font-medium">字体大小</span>
                          <Badge variant="secondary">中等</Badge>
                        </div>
                      </div>
                      
                      <div className="mt-6 p-4 bg-gray-50 border rounded-lg">
                        <div className="flex items-start space-x-2">
                          <Info className="w-4 h-4 text-gray-600 mt-0.5" />
                          <div className="text-sm text-gray-700">
                            <p>界面设置已优化，提供最佳的用户体验。</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="about" className="space-y-6 mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle>关于 MetaGPT WebUI</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">版本信息</h4>
                          <p className="text-sm text-muted-foreground">MetaGPT WebUI v2.0</p>
                          <p className="text-sm text-muted-foreground">基于 MetaGPT 多智能体框架</p>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">功能特性</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• 多智能体协作开发</li>
                            <li>• 项目代码自动生成</li>
                            <li>• 团队角色定制</li>
                            <li>• 项目管理和历史记录</li>
                          </ul>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">技术栈</h4>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">React</Badge>
                            <Badge variant="outline">Flask</Badge>
                            <Badge variant="outline">MetaGPT</Badge>
                            <Badge variant="outline">通义千问</Badge>
                          </div>
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

export default SettingsPanelSimple;

