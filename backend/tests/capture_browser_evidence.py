import subprocess
import time
import urllib.request
import sys
import os
from pathlib import Path

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
python_path = r"C:\Users\pc\AppData\Local\Microsoft\WindowsApps\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\python.exe"

print("[*] Starting backend and frontend processes...")
backend_proc = subprocess.Popen([python_path, "run_backend.py"])
frontend_proc = subprocess.Popen(["npm.cmd", "run", "dev"])

try:
    print("[*] Waiting for servers to come alive...")
    backend_up = False
    frontend_up = False

    for attempt in range(15):
        time.sleep(1)
        if not backend_up:
            try:
                with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=1) as res:
                    if res.status == 200:
                        backend_up = True
                        print("  [+] Backend is UP on http://127.0.0.1:8000")
            except Exception:
                pass

        if not frontend_up:
            try:
                with urllib.request.urlopen("http://localhost:5173", timeout=1) as res:
                    if res.status == 200:
                        frontend_up = True
                        print("  [+] Frontend is UP on http://localhost:5173")
            except Exception:
                pass

        if backend_up and frontend_up:
            break

    if not frontend_up:
        print("[!] Frontend did not start in time.")
    else:
        print("[*] Capturing real Chrome browser screenshots...")
        time.sleep(2) # Give Vite app time to bundle & initialize Leaflet
        
        screens = [
            ("evidence_citizen_dashboard.png", "http://localhost:5173/#overview"),
            ("evidence_citizen_report_flow.png", "http://localhost:5173/#report"),
            ("evidence_journalist_verify_desk.png", "http://localhost:5173/#verify"),
        ]

        for filename, url in screens:
            cmd = [
                chrome_path,
                "--headless=new",
                "--disable-gpu",
                "--window-size=1280,850",
                f"--screenshot={filename}",
                url
            ]
            print(f"  [>] Capturing {filename} from {url}...")
            subprocess.run(cmd, capture_output=True, timeout=15)
            if os.path.exists(filename):
                size = os.path.getsize(filename)
                print(f"  [+] SUCCESS: {filename} captured ({size:,} bytes)")
            else:
                print(f"  [-] Failed to capture {filename}")

finally:
    print("[*] Cleaning up server processes...")
    try:
        backend_proc.terminate()
    except Exception:
        pass
    try:
        frontend_proc.terminate()
    except Exception:
        pass
    # Force kill any dangling node / python from this test
    subprocess.run(["taskkill", "/F", "/T", "/PID", str(backend_proc.pid)], capture_output=True)
    subprocess.run(["taskkill", "/F", "/T", "/PID", str(frontend_proc.pid)], capture_output=True)

print("[*] Finished browser evidence capture.")

