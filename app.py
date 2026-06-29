import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")


def required_env(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required. Check .env or backend/.env.")
    return value


class SportsmateHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Strip query parameters (e.g., ?v=2)
        clean_path = path.split("?")[0]
        if clean_path == "/":
            clean_path = "/templates/index.html"
        return str(ROOT / clean_path.lstrip("/"))


def run(host=None, port=None):
    resolved_host = host or os.getenv("STATIC_RUN_HOST", "127.0.0.1")
    resolved_port = int(port or required_env("STATIC_RUN_PORT"))
    server = ThreadingHTTPServer((resolved_host, resolved_port), SportsmateHandler)
    print(f"Sportsmate is running at http://{resolved_host}:{resolved_port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
