import sys
import os

sys.path.insert(0, os.path.abspath("."))

try:
    from apps.studycafe.backend.routers import (
        seat_router, ticket_router, session_router,
        door_router, ai_router, studycafe_selfstudy_router, study_auth_router
    )
    print("✅ SUCCESS: All StudyCafe routers imported properly!")

    from apps.studycafe.backend.main import app
    print("✅ SUCCESS: StudyCafe standalone main app created!")
    print(f"Total Routes in StudyCafe: {len(app.routes)}")

    from gateway.main import app as gateway_app
    print("✅ SUCCESS: Gateway app loaded successfully!")
    print(f"Total Routes in Gateway: {len(gateway_app.routes)}")
except Exception as e:
    import traceback
    traceback.print_exc()
    print("❌ ERROR:", e)
