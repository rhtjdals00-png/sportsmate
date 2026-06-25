from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent


class SportsmateHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Strip query parameters (e.g., ?v=2)
        clean_path = path.split("?")[0]
        if clean_path == "/":
            clean_path = "/templates/index.html"
        return str(ROOT / clean_path.lstrip("/"))


def run(host="127.0.0.1", port=8000):
    server = ThreadingHTTPServer((host, port), SportsmateHandler)
    print(f"Sportsmate is running at http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
