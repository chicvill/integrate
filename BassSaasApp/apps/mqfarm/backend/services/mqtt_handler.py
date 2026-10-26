import logging

logger = logging.getLogger("smartfarm_mqtt")

class MQTTSmartFarmBridge:
    def send_actuator_command(self, actuator_name: str, state: bool) -> bool:
        command = "ON" if state else "OFF"
        logger.info(f"[MQTT IoT] ESP32 Actuator Command -> {actuator_name}: {command}")
        return True

mqtt_bridge = MQTTSmartFarmBridge()
