from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api import auth, users, supervisors, ratings, comments, analytics, chats, edit_proposals

app = FastAPI(
    title="研选 GradChoice API",
    description="匿名导师评分平台 API — 帮助研究生选择导师，保障学生权益",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(supervisors.router)
app.include_router(ratings.router)
app.include_router(comments.router)
app.include_router(analytics.router)
app.include_router(chats.router)
app.include_router(edit_proposals.router)


@app.get("/", tags=["健康检查"])
def root():
    return {"message": "研选 GradChoice API 正在运行", "docs": "/docs"}


@app.get("/health", tags=["健康检查"])
def health():
    return {"status": "ok"}
