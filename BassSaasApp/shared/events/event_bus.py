"""
shared/events/event_bus.py
경량 비동기 이벤트 버스 (In-Memory Pub/Sub) 및 Server-Sent Events (SSE) 헬퍼.
스터디카페 좌석 변동, 매장 주문 알림, 스마트팜 센서 경보 등의 실시간 이벤트 전파에 사용됩니다.
"""
import asyncio
import json
import logging
from typing import Dict, Set, Any, AsyncGenerator, Optional

logger = logging.getLogger("mqnet.events")


class EventBus:
    """비동기 인메모리 이벤트 브로커"""

    def __init__(self):
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}

    def subscribe(self, topic: str) -> asyncio.Queue:
        """토픽 구독 및 이벤트 큐 반환"""
        if topic not in self._subscribers:
            self._subscribers[topic] = set()
        queue = asyncio.Queue()
        self._subscribers[topic].add(queue)
        logger.debug(f"토픽 구독: {topic} (현재 구독자 수: {len(self._subscribers[topic])})")
        return queue

    def unsubscribe(self, topic: str, queue: asyncio.Queue):
        """토픽 구독 해제"""
        if topic in self._subscribers:
            self._subscribers[topic].discard(queue)
            if not self._subscribers[topic]:
                del self._subscribers[topic]
        logger.debug(f"토픽 구독 해제: {topic}")

    async def publish(self, topic: str, data: Any):
        """토픽에 이벤트 발행 (모든 구독자에게 브로드캐스트)"""
        if topic not in self._subscribers:
            return

        payload = data if isinstance(data, (dict, list, str, int, float, bool)) else str(data)
        subscribers = list(self._subscribers[topic])
        for q in subscribers:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                pass

    async def sse_stream(self, topic: str, ping_interval: int = 15) -> AsyncGenerator[str, None]:
        """
        FastAPI StreamingResponse용 Server-Sent Events (SSE) 제너레이터.
        
        사용 예시:
            @app.get("/events/stream")
            async def stream_events():
                return StreamingResponse(event_bus.sse_stream("store:orders"), media_type="text/event-stream")
        """
        queue = self.subscribe(topic)
        try:
            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=ping_interval)
                    formatted_data = json.dumps(data, ensure_ascii=False) if isinstance(data, (dict, list)) else str(data)
                    yield f"data: {formatted_data}\n\n"
                except asyncio.TimeoutError:
                    # 연결 유지를 위한 하트비트 핑 전송
                    yield ": ping\n\n"
        finally:
            self.unsubscribe(topic, queue)


# 전역 기본 이벤트 버스 싱글톤
global_event_bus = EventBus()


def get_event_bus() -> EventBus:
    return global_event_bus
