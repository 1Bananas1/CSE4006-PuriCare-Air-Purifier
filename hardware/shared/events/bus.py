from typing import Callable, Dict, List
from datetime import datetime

class EventBus:
    """
    Simple in memory event-bus
    """
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}
        pass
    
    def subscribe(self, event_type: str, handler: Callable):
        """
        Subscribe to an event
        """
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        print(f"✅ Subscribed to {event_type}")
    
    def publish(self, event_type: str, data: dict):
        """
        Publish an event to all subscribers
        """
        if event_type in self._subscribers:
            for handler in self._subscribers[event_type]:
                try:
                    handler(data)
                except Exception as e:
                    print(f"❌ Error in handler: {e}")