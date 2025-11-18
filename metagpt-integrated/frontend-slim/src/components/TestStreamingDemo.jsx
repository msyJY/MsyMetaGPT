import React, { useState, useEffect } from 'react';
import EnhancedStreamingMessage from './EnhancedStreamingMessage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const TestStreamingDemo = () => {
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const testContent = `# 产品竞争力象限图分析

我来为您生成一个产品竞争力象限图，并解释其含义。

## 象限图表

\`\`\`mermaid
quadrantChart
    title "产品到达和参与度"
    x-axis "低到达率" --> "高到达率"
    y-axis "低参与度" --> "高参与度"
    quadrant-1 "我们需要推广"
    quadrant-2 "我们需要促进"
    quadrant-3 "重新评估"
    quadrant-4 "可能的快速获胜"
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]
    Campaign C: [0.57, 0.69]
    Campaign D: [0.78, 0.34]
    Campaign E: [0.40, 0.34]
\`\`\`

## 图表含义解释

这个象限图展示了不同营销活动在**到达率**和**参与度**两个维度上的表现：

### 四个象限的含义：

1. **象限1 - 我们需要推广**（高参与度，低到达率）
   - 特点：用户参与度高，但覆盖面小
   - 策略：扩大推广范围，增加曝光度
   - 示例：Campaign A 位于此象限

2. **象限2 - 我们需要促进**（高参与度，高到达率）
   - 特点：既有高覆盖又有高参与
   - 策略：这是理想状态，继续保持并优化
   - 示例：Campaign C 位于此象限

3. **象限3 - 重新评估**（低参与度，低到达率）
   - 特点：表现最差，需要重新审视
   - 策略：分析失败原因，考虑重新设计或停止
   - 示例：Campaign B 和 E 位于此象限

4. **象限4 - 可能的快速获胜**（低参与度，高到达率）
   - 特点：覆盖面广但参与度低
   - 策略：优化内容质量，提高用户参与
   - 示例：Campaign D 位于此象限

### 代码示例

\`\`\`python
# 数据分析代码示例
import matplotlib.pyplot as plt
import numpy as np

# 活动数据
campaigns = {
    'Campaign A': [0.3, 0.6],
    'Campaign B': [0.45, 0.23],
    'Campaign C': [0.57, 0.69],
    'Campaign D': [0.78, 0.34],
    'Campaign E': [0.40, 0.34]
}

# 创建散点图
fig, ax = plt.subplots(figsize=(10, 8))
for name, (x, y) in campaigns.items():
    ax.scatter(x, y, s=100, alpha=0.7)
    ax.annotate(name, (x, y), xytext=(5, 5), 
                textcoords='offset points')

ax.set_xlabel('到达率')
ax.set_ylabel('参与度')
ax.set_title('产品竞争力象限图')
ax.grid(True, alpha=0.3)
plt.show()
\`\`\`

### 关键洞察

> **重要提示**：这种分析方法可以帮助团队快速识别哪些营销活动需要优化，哪些值得加大投入。

通过这个象限图，我们可以清晰地看到：
- **Campaign C** 表现最佳，应该作为标杆
- **Campaign A** 有潜力，需要扩大推广
- **Campaign D** 需要提升内容质量
- **Campaign B** 和 **E** 需要重新评估策略

这种可视化分析方法在产品管理、市场营销等领域都有广泛应用。`;

  const simulateStreaming = () => {
    setIsStreaming(true);
    setIsComplete(false);
    setStreamingContent('');
    
    const words = testContent.split('');
    let currentIndex = 0;
    
    const interval = setInterval(() => {
      if (currentIndex < words.length) {
        setStreamingContent(prev => prev + words[currentIndex]);
        currentIndex++;
      } else {
        setIsStreaming(false);
        setIsComplete(true);
        clearInterval(interval);
      }
    }, 20); // 每20ms添加一个字符，模拟流式输出
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="p-6 bg-gray-800 border-gray-700 mb-6">
          <h1 className="text-2xl font-bold text-gray-100 mb-4">前端优化效果测试</h1>
          <p className="text-gray-300 mb-4">
            这个演示展示了优化后的前端效果，包括：
          </p>
          <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">
            <li>简约的灰黑色主题</li>
            <li>增强的Mermaid图表渲染（支持quadrantChart等所有类型）</li>
            <li>改进的滚动查看功能</li>
            <li>流式输出内容持久化</li>
          </ul>
          <Button 
            onClick={simulateStreaming} 
            disabled={isStreaming}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isStreaming ? '正在流式输出...' : '开始测试流式输出'}
          </Button>
        </Card>

        {(streamingContent || isComplete) && (
          <div className="mb-6">
            <EnhancedStreamingMessage 
              content={streamingContent} 
              isComplete={isComplete}
            />
          </div>
        )}

        {isComplete && (
          <Card className="p-4 bg-green-900/20 border-green-700">
            <p className="text-green-300 text-sm">
              ✅ 测试完成！流式输出内容已保存，可以通过滚动查看所有内容。
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TestStreamingDemo;

