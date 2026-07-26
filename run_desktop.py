"""
PG Manager - Desktop Launcher
Runs the FastAPI backend in a background thread and opens it in a native
desktop window using pywebview. Fully offline - no internet required.
"""
import threading
import time
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

import uvicorn
import webview
from main import app

HOST = "127.0.0.1"
PORT = 8642


def run_server():
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")


if __name__ == "__main__":
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    time.sleep(1.2)  # give uvicorn a moment to start

    webview.create_window(
        "PG Manager",
        f"http://{HOST}:{PORT}",
        width=1440,
        height=900,
        min_size=(1100, 700),
    )
    webview.start()
