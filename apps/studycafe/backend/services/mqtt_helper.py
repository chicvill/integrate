import logging
from backend.config import settings

logger = logging.getLogger("mqtt_helper")

class MQTTHelper:
    def __init__(self):
        self.host = settings.MQTT_BROKER_HOST
        self.port = settings.MQTT_BROKER_PORT
        self.topic = settings.MQTT_TOPIC_DOOR

    def trigger_door_open(self, user_name: str, door_id: str = "FRONT_DOOR") -> bool:
        """Triggers local ESP32 NFC door open via MQTT or Serial."""
        logger.info(f"[NFC DOOR] Opening door '{door_id}' for user '{user_name}' via MQTT ({self.host}:{self.port})")
        # In a live environment with paho-mqtt broker:
        # client.publish(self.topic, json.dumps({"action": "OPEN", "door": door_id, "user": user_name}))
        return True

mqtt_helper = MQTTHelper()
