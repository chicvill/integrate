from apps.smartfarm.backend.routers.sensors import router as sensor_router
from apps.smartfarm.backend.routers.actuators import router as actuator_router
from apps.smartfarm.backend.routers.growth import router as growth_router

__all__ = ["sensor_router", "actuator_router", "growth_router"]
