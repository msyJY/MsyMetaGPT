import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.config.llm_config_override import apply_llm_config_override

# 应用LLM配置覆盖并获取配置对象
llm_config_obj = apply_llm_config_override()

# 设置环境变量，确保metagpt.config2在加载时能获取到LLM配置
os.environ["METAGPT_LLM_API_TYPE"] = llm_config_obj.api_type.value
os.environ["METAGPT_LLM_BASE_URL"] = llm_config_obj.base_url
os.environ["METAGPT_LLM_API_KEY"] = llm_config_obj.api_key
os.environ["METAGPT_LLM_MODEL"] = llm_config_obj.model
os.environ["METAGPT_LLM_MAX_TOKEN"] = str(llm_config_obj.max_token)
os.environ["METAGPT_LLM_TEMPERATURE"] = str(llm_config_obj.temperature)

# 现在可以安全地导入metagpt.config2，它将使用设置的环境变量
from metagpt.config2 import config as metagpt_global_config

from flask import Flask, send_from_directory
from flask_cors import CORS
from src.models.user import db
from src.routes.user import user_bp


from src.routes.metagpt_api_sse_new import metagpt_bp
from src.routes.chat_history import chat_history_bp
from src.routes.file_download import file_download_bp
from src.routes.workspace_files import workspace_files_bp

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'

# 启用CORS
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(metagpt_bp)
app.register_blueprint(chat_history_bp)
app.register_blueprint(file_download_bp)
app.register_blueprint(workspace_files_bp)

# uncomment if you need to use database
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
with app.app_context():
    db.create_all()

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
            return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404


@app.route('/api/metagpt/health', methods=['GET'])
def health_check():
    return {"status": "ok"}


if __name__ == '__main__':
    # Disable reloader to avoid duplicate binding errors in debug
    backend_port = int(os.environ.get('METAGPT_BACKEND_PORT') or os.environ.get('BACKEND_PORT') or 5001)
    app.run(host='0.0.0.0', port=backend_port, debug=False, use_reloader=False)


