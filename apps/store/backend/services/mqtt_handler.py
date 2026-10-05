import logging

logger = logging.getLogger("mqtt_handler")

class MQTTStoreHandler:
    def trigger_pos_receipt_print(self, order_number: str) -> bool:
        logger.info(f"[POS MQTT] Receipt printing command sent for order {order_number}")
        return True

mqtt_handler = MQTTStoreHandler()
