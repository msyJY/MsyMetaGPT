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

### 步骤3: 启动服务 手动启动各服务

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