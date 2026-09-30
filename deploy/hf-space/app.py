"""Hugging Face Spaces 入口。

平台上 7860 是默认对外端口，这里同时监听 7860 与 4000，
保证 HF（读 7860）和本地调试（读 4000）都能用。
另外提供 /__health 供平台探活。
"""

import os
import threading
import time
import urllib.request

APP_PORT = int(os.environ.get("APP_PORT", "4000"))
HF_PORT = int(os.environ.get("HF_PORT", "7860"))


def wait_up(port: int, timeout: int = 30) -> None:
    """等待主应用就绪后再继续。"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2) as r:
                if r.status == 200:
                    return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError(f"app on :{port} did not become healthy")


if __name__ == "__main__":
    threading.Thread(
        target=lambda: os.execvp("node", ["node", "src/server.js"]),
        daemon=True,
    ).start()
    wait_up(APP_PORT)

    from http.server import BaseHTTPRequestHandler, HTTPServer

    class Proxy(BaseHTTPRequestHandler):
        def do_GET(self):
            try:
                req = urllib.request.Request(
                    f"http://127.0.0.1:{APP_PORT}{self.path}"
                )
                with urllib.request.urlopen(req, timeout=30) as r:
                    body = r.read()
                    self.send_response(r.status)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(body)
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self.end_headers()
                self.wfile.write(e.read())
            except Exception as e:
                self.send_response(502)
                self.end_headers()
                self.wfile.write(str(e).encode())

        def log_message(self, *a):
            pass

    HTTPServer(("0.0.0.0", HF_PORT), Proxy).serve_forever()
