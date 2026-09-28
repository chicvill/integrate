import os
from shared.core.base_config import BaseConfig

class AppConfig(BaseConfig):
    APP_ID: str = "{{APP_ID}}"
    APP_NAME: str = "{{APP_NAME}}"
    APP_CATEGORY: str = "{{APP_CATEGORY}}"
    PORT: int = int(os.getenv("PORT", "{{APP_PORT}}"))

settings = AppConfig()
