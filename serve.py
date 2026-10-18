"""Local dev server that behaves like GitHub Pages: real files are served, unknown paths get 404.html,
which hands the path to the single-page app. Run: python3 serve.py  ->  http://localhost:8000"""
import http.server, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def send_head(self):
        path = self.translate_path(self.path.split('?')[0])
        if os.path.isdir(path) and os.path.exists(os.path.join(path, 'index.html')) or os.path.isfile(path):
            return super().send_head()
        body = open(os.path.join(ROOT, '404.html'), 'rb').read()
        self.send_response(404)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        from io import BytesIO
        return BytesIO(body)


if __name__ == '__main__':
    print(f'Re:Root running at http://localhost:{PORT}')
    http.server.ThreadingHTTPServer(('', PORT), Handler).serve_forever()
