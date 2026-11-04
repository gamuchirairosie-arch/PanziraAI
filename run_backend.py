"""Root Development Server Runner

Run from project root:
    python run_backend.py
"""

import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import uvicorn

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    print(f"[*] Starting Panzira AI Backend Server on {host}:{port} from: {backend_dir}")
    print(f"[*] API Documentation available at: http://{host if host != '0.0.0.0' else '127.0.0.1'}:{port}/docs")
    print(f"[*] Health endpoint: http://{host if host != '0.0.0.0' else '127.0.0.1'}:{port}/health")
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=False if os.getenv("PRODUCTION") == "true" else True,
        app_dir=str(backend_dir),
    )
