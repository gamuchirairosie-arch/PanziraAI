"""Development Server Runner

Starts the Panzira AI backend service with live reloading.
Automatically resolves app directory and sys.path regardless of execution folder.
"""

import sys
import os
from pathlib import Path
import uvicorn

# Ensure 'backend' directory is always at the front of sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if __name__ == "__main__":
    print(f"[*] Starting Panzira AI Backend Server from: {backend_dir}")
    print("[*] API Documentation available at: http://127.0.0.1:8000/docs")
    print("[*] Health endpoint: http://127.0.0.1:8000/health")
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        app_dir=str(backend_dir),
    )
