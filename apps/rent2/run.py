"""rent2 단독 실행:  py apps/rent2/run.py  →  http://localhost:9016/  (AI 비서: /ai.html)"""
import os
import sys

import uvicorn

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

if __name__ == "__main__":
    uvicorn.run("apps.rent2.backend.main:create_app", factory=True, host=os.getenv("HOST", "0.0.0.0"),
                port=int(os.getenv("PORT", "9016")), reload=False)
