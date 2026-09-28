from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from shared.core.base_app import BaseApp
from .config import settings

class Application(BaseApp):
    def __init__(self):
        super().__init__(
            title=f"MQnet {settings.APP_NAME}",
            description=f"{settings.APP_NAME} SaaS Service",
            version="1.0.0"
        )
        self.setup_routes()

    def setup_routes(self):
        @self.app.get("/health", tags=["Health"])
        async def health_check():
            return {
                "status": "healthy",
                "app_id": settings.APP_ID,
                "app_name": settings.APP_NAME
            }

        @self.app.get("/api/data", tags=["API"])
        async def get_sample_data():
            return {
                "message": f"Welcome to {settings.APP_NAME} API",
                "items": [
                    {"id": 1, "title": "기본 대시보드 아이템 1", "status": "active"},
                    {"id": 2, "title": "기본 대시보드 아이템 2", "status": "pending"}
                ]
            }

service = Application()
app = service.app
