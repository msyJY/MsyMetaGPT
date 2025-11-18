import React from 'react';

const SimpleApp = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>MetaGPT WebUI</h1>
      <p>这是一个简单的测试页面</p>
      <button onClick={() => alert('按钮点击成功!')}>
        测试按钮
      </button>
    </div>
  );
};

export default SimpleApp;

