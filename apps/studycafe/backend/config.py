import os
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env file from project root or backend folder
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

class Settings(BaseModel):
    # Deployment & Features
    DEPLOYMENT_MODE: str = os.getenv("DEPLOYMENT_MODE", "LOCAL_STANDALONE").upper()
    ENABLE_SELFSTUDY: bool = os.getenv("ENABLE_SELFSTUDY", "true").lower() == "true"
    ENABLE_NFC_DOOR: bool = os.getenv("ENABLE_NFC_DOOR", "true").lower() == "true"
    ENABLE_CLOUD_SYNC: bool = os.getenv("ENABLE_CLOUD_SYNC", "true").lower() == "true"

    # Database & Security
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./studycafe.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "mqnet_studycafe_unified_secret_key_2026")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # IoT & MQTT
    MQTT_BROKER_HOST: str = os.getenv("MQTT_BROKER_HOST", "localhost")
    MQTT_BROKER_PORT: int = int(os.getenv("MQTT_BROKER_PORT", "1883"))
    MQTT_TOPIC_DOOR: str = os.getenv("MQTT_TOPIC_DOOR", "studycafe/door/control")

    # Server Info
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8001"))

    @property
    def is_standalone(self) -> bool:
        return self.DEPLOYMENT_MODE == "LOCAL_STANDALONE"


settings = Settings()

def get_settings() -> Settings:
    return settings

