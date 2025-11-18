# 安装指南

## 系统要求

- Ubuntu 22.04 或类似Linux发行版
- Python 3.11+
- Node.js 22.13.0+
- npm 或 yarn

## 快速安装

### 1. 解压文件
```bash
unzip metagpt-jupyter-integration-$(date +%Y%m%d_%H%M%S).zip
cd metagpt-jupyter-integration-*
```

### 2. 安装系统依赖
```bash
# 安装Python依赖
pip3 install jupyterlab flask flask-cors sqlalchemy

# 安装Node.js依赖（如果需要）
sudo apt update
sudo apt install nodejs npm
```

### 3. 一键启动
```bash
cd metagpt-integrated
python3 jupyter_startup.py
```

### 4. 访问JupyterLab
在浏览器中打开显示的URL（通常是 http://localhost:8888），在左侧边栏找到"MetaGPT"按钮。

## 详细安装步骤

### 步骤1: 安装JupyterLab扩展

```bash
cd jupyterlab-metagpt-extension

# 安装npm依赖
npm install

# 构建扩展
npm run build:lib
npm run build:labextension:dev

# 安装Python包
pip install -e .

# 开发模式安装扩展
jupyter labextension develop . --overwrite
```

### 步骤2: 准备MetaGPT服务

```bash
cd ../metagpt-integrated

# 安装前端依赖
cd frontend-slim
npm install --legacy-peer-deps
cd ..

# 安装后端依赖
cd backend
pip install -r requirements.txt  # 如果有requirements.txt文件
cd ..
```

### 步骤3: 启动服务

#### 方法A: 使用启动脚本
```bash
python3 start_services.py
```

#### 方法B: 手动启动各服务

终端1 - 启动后端:
```bash
cd backend
python3 src/main.py
```

终端2 - 启动前端:
```bash
cd frontend-slim
npm run dev
```

终端3 - 启动JupyterLab:
```bash
jupyter lab --ip=0.0.0.0 --port=8888 --no-browser --allow-root
```

## 验证安装

1. 打开JupyterLab (http://localhost:8888)
2. 在左侧边栏应该能看到"MetaGPT"标签
3. 点击MetaGPT标签，应该能看到"打开 MetaGPT"按钮
4. 点击按钮，应该在新标签页中打开MetaGPT界面

## 常见问题

### Q: 扩展没有出现在左侧边栏
A: 
1. 检查扩展是否正确安装: `jupyter labextension list`
2. 重启JupyterLab
3. 清除浏览器缓存

### Q: 前端服务启动失败
A:
1. 检查端口3000是否被占用: `lsof -i :3000`
2. 尝试使用 `--legacy-peer-deps` 安装依赖
3. 检查Node.js版本是否兼容

### Q: 后端服务连接失败
A:
1. 检查端口5001是否被占用: `lsof -i :5001`
2. 检查Python依赖是否完整安装
3. 查看后端日志输出

### Q: MetaGPT界面无法加载
A:
1. 确保前后端服务都正常运行
2. 检查浏览器控制台是否有错误信息
3. 确认CORS配置正确

## 卸载

```bash
# 卸载JupyterLab扩展
pip uninstall jupyterlab_metagpt_extension

# 移除开发链接
jupyter labextension uninstall jupyterlab-metagpt-extension

# 停止所有服务
pkill -f "python.*start_services.py"
pkill -f "npm.*run.*dev"
pkill -f "jupyter.*lab"
```

