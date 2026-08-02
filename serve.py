#!/usr/bin/env python3
"""
Local server for the Hong Kong Typhoon Dashboard.

Why this exists:
  The HKIA ATIS page (atis.cad.gov.hk) sends
  `Content-Security-Policy: frame-ancestors 'self'`, which forbids any other
  site from embedding it in an <iframe>. This server reverse-proxies ATIS
  through a same-origin path (/atis/...), strips that header, and rewrites
  absolute URLs so the dashboard can show ATIS inline.

Run:
  python serve.py
Then open http://127.0.0.1:8765/

(If you use `python -m http.server` instead, the inline ATIS panel will be
 blank and the "Open in new tab" link is shown as a fallback.)
"""

import http.server
import socketserver
import urllib.request
import os
import re

PORT = 8765
ORIGIN = "https://atis.cad.gov.hk"

# Proxy route -> upstream base path on ORIGIN
PROXY_ROUTES = {
    "/atis/": "/ATIS/ATISweb",
    "/atisdata/": "/ATIS/atis_data",
    "/atisimg/": "/ATIS/images",
    "/atisroot/": "/ATIS",
}

# Rewrites applied to proxied HTML/JS/CSS text so assets resolve via the proxy
REWRITES = [
    ("https://atis.cad.gov.hk", ""),
    ("/ATIS/ATISweb", "/atis"),
    ("/ATIS/atis_data", "/atisdata"),
    ("/ATIS/images", "/atisimg"),
    ("../atis_data", "/atisdata"),
    ("/ATIS/", "/atisroot/"),
]

STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # Route proxy paths first (most specific prefix wins)
        for prefix, base in PROXY_ROUTES.items():
            if self.path.startswith(prefix):
                self.proxy(ORIGIN + base + self.path[len(prefix) - 1:])
                return
        self.serve_static()

    def proxy(self, url):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=25) as r:
                data = r.read()
                ctype = r.headers.get("Content-Type", "application/octet-stream")
            # Rewrite text assets so they load through the proxy
            if "text/html" in ctype or "javascript" in ctype or "text/css" in ctype:
                text = data.decode("utf-8", errors="replace")
                for a, b in REWRITES:
                    text = text.replace(a, b)
                data = text.encode("utf-8")
                ctype = re.sub(r";\s*charset=.*", "", ctype) + "; charset=utf-8"
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", len(data))
            self.send_header("Access-Control-Allow-Origin", "*")
            # Strip the embedding block so the iframe is allowed
            self.send_header("Content-Security-Policy", "frame-ancestors *")
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(502, "ATIS proxy error: " + str(e))

    def serve_static(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            path = "/index.html"
        fpath = os.path.normpath(os.path.join(os.getcwd(), path.lstrip("/")))
        if os.path.isfile(fpath):
            with open(fpath, "rb") as f:
                data = f.read()
            ext = os.path.splitext(fpath)[1]
            ctype = STATIC_TYPES.get(ext, "application/octet-stream")
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", len(data))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_error(404, "Not found: " + path)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving dashboard + ATIS proxy at http://127.0.0.1:{PORT}/")
        httpd.serve_forever()
