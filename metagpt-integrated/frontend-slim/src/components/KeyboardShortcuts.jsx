import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Keyboard, Command } from 'lucide-react';

const KeyboardShortcuts = () => {
  const shortcuts = [
    {
      category: '导航',
      items: [
        { keys: ['Ctrl', 'N'], description: '新建对话' },
        { keys: ['Ctrl', 'H'], description: '查看历史记录' },
        { keys: ['Ctrl', 'P'], description: '项目管理' },
        { keys: ['Ctrl', 'A'], description: '智能体角色' },
        { keys: ['Ctrl', ','], description: '设置' },
      ]
    },
    {
      category: '聊天',
      items: [
        { keys: ['Enter'], description: '发送消息' },
        { keys: ['Shift', 'Enter'], description: '换行' },
        { keys: ['Ctrl', 'C'], description: '复制消息' },
        { keys: ['Ctrl', 'R'], description: '重新生成回复' },
        { keys: ['Escape'], description: '取消输入' },
      ]
    },
    {
      category: '界面',
      items: [
        { keys: ['Ctrl', 'B'], description: '切换侧边栏' },
        { keys: ['Ctrl', 'T'], description: '切换主题' },
        { keys: ['Ctrl', '/'], description: '显示快捷键帮助' },
        { keys: ['F11'], description: '全屏模式' },
      ]
    },
    {
      category: '编辑',
      items: [
        { keys: ['Ctrl', 'Z'], description: '撤销' },
        { keys: ['Ctrl', 'Y'], description: '重做' },
        { keys: ['Ctrl', 'A'], description: '全选' },
        { keys: ['Ctrl', 'F'], description: '查找' },
      ]
    }
  ];

  const KeyBadge = ({ keyName }) => (
    <Badge variant="outline" className="px-2 py-1 text-xs font-mono">
      {keyName}
    </Badge>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Keyboard className="w-4 h-4" />
          快捷键
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="w-5 h-5" />
            键盘快捷键
          </DialogTitle>
          <DialogDescription>
            使用这些快捷键可以更高效地使用MetaGPT WebUI
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {shortcuts.map((category, categoryIndex) => (
            <Card key={categoryIndex}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{category.category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {category.items.map((shortcut, shortcutIndex) => (
                    <div
                      key={shortcutIndex}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            <KeyBadge keyName={key} />
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-xs text-muted-foreground mx-1">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>提示:</strong> 在输入框中时，只有包含 Ctrl 或 Cmd 的快捷键会生效。
            按 <KeyBadge keyName="Ctrl" /> + <KeyBadge keyName="/" /> 可以随时打开此帮助。
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcuts;

