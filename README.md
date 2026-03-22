# 研选 GradChoice

**中立、公开、免费的研究生导师匿名评分平台**

> 帮助研究生选择导师，保障学术发展与身心健康。

---

## 核心原则

| 原则 | 说明 |
|------|------|
| 中立客观 | 平台不持立场，忠实呈现社区评价，不删除负面评价 |
| 公开透明 | 评分数据全公开，算法透明，运营情况定期公示 |
| 免费开源 | 永久免费，MIT 协议，代码开源，接受公众监督 |
| 保护隐私 | 所有评价匿名发布，严格保护用户个人信息 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 后端 | FastAPI (Python 3.12) |
| 数据库 | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0 + Alembic |
| 认证 | JWT (python-jose + passlib) |
| 容器化 | Docker + Docker Compose |

---

## 本地运行

### 前置要求

- Docker & Docker Compose
- （可选）Python 3.12+ 和 Node.js 20+（用于本地开发）

### 1. 克隆仓库

```bash
git clone https://github.com/your-org/gradchoice.git
cd gradchoice
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，至少修改 SECRET_KEY
```

### 3. 启动服务

```bash
docker-compose up --build
```

服务启动后：
- **前端**: http://localhost:3000
- **后端 API**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs

### 4. 数据库迁移

```bash
# 进入后端容器
docker-compose exec api alembic upgrade head

# 或本地运行
cd backend
alembic upgrade head
```

---

## 导入导师数据

准备好 CSV 文件（每所院校一个文件），放入目录后执行：

```bash
# Docker 方式
docker-compose exec api python seed_tutors.py \
  --csv-dir /path/to/tutors/ \
  --db-url postgresql://gradchoice:gradchoice_dev@db:5432/gradchoice

# 本地方式
cd backend
python seed_tutors.py --csv-dir /mnt/d/Startup\ projects/cn-grad-units/tutors/

# 模拟运行（不写入数据库）
python seed_tutors.py --dry-run
```

### CSV 格式要求

| 列名 | 必填 | 说明 |
|------|------|------|
| 院校代码 | 是 | 教育部院校代码 |
| 院校 | 是 | 院校全称 |
| 省份 | 是 | 所在省份 |
| 导师姓名 | 是 | 导师姓名 |
| 导师院系/单位 | 是 | 所在院系或单位 |
| 职级 | 否 | 如：教授、副教授 |
| 合作/挂名单位 | 否 | 合作单位 |

---

## 本地开发（不用 Docker）

### 后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 确保 PostgreSQL 运行后
alembic upgrade head
uvicorn app.main:app --reload
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

---

## API 文档

启动后访问 http://localhost:8000/docs 查看交互式 API 文档（Swagger UI）。

### 主要接口

| 模块 | 接口 |
|------|------|
| 认证 | `POST /auth/register`, `POST /auth/login`, `POST /auth/verify-email` |
| 用户 | `GET /users/me`, `PUT /users/me`, `GET /users/{id}/profile` |
| 导师 | `GET /supervisors/search`, `GET /supervisors/{id}` |
| 评分 | `POST /ratings`, `GET /ratings/supervisor/{id}` |
| 评论 | `POST /comments`, `GET /comments/supervisor/{id}` |
| 分析 | `GET /analytics/supervisor/{id}`, `GET /analytics/rankings` |
| 私信 | `POST /chats`, `GET /chats`, `POST /chats/{id}/messages` |
| 编辑申请 | `POST /edit-proposals`, `POST /edit-proposals/{id}/review` |

---

## 项目结构

```
GradChoice/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口
│   │   ├── config.py            # 配置（环境变量）
│   │   ├── database.py          # SQLAlchemy 引擎/会话
│   │   ├── models/              # ORM 模型
│   │   ├── schemas/             # Pydantic 模型
│   │   ├── api/                 # 路由处理器
│   │   ├── services/            # 业务逻辑（待实现）
│   │   └── utils/               # 工具函数（JWT、密码等）
│   ├── alembic/                 # 数据库迁移
│   ├── seed_tutors.py           # 导师数据导入脚本
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # 通用组件
│   │   ├── pages/               # 页面组件
│   │   ├── services/api.ts      # API 客户端
│   │   ├── types/               # TypeScript 类型定义
│   │   ├── i18n/zh.ts           # 中文界面文本
│   │   └── App.tsx              # 路由配置
│   └── package.json
├── docker-compose.yml
└── .env.example
```

---

## 数据库 Schema

主要数据表：

- **users** — 用户账号，支持邮箱验证和学生认证
- **supervisors** — 导师信息，按（院校代码、姓名、院系）去重
- **ratings** — 导师评分（6 个维度），每用户每导师限评一次
- **rating_votes** — 评分投票（有用/无用）
- **comments** — 评论与回复（支持多级嵌套）
- **comment_votes** — 评论投票（赞/踩）
- **chats + chat_messages** — 用户间匿名私信
- **edit_proposals** — 社区驱动的导师信息编辑申请（需两人审核通过）

---

## 参与贡献

欢迎提交 Pull Request！请遵循以下流程：

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/your-feature`
3. 提交代码：`git commit -m "feat: 添加 xxx 功能"`
4. 推送分支并创建 Pull Request

### 代码规范

- **Python**: 遵循 PEP 8，使用 type hints
- **TypeScript**: strict 模式，组件使用函数式写法
- **提交信息**: 遵循 Conventional Commits 规范

---

## 许可证

MIT License

---

*研选 GradChoice — 让每一位研究生都能做出知情的选择*
