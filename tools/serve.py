#!/usr/bin/env python3
"""Static server that refuses to be cached.

python3 -m http.server sends Last-Modified and no Cache-Control, so browsers fall
back to heuristic freshness — roughly a tenth of the file's age — and will happily
serve a stale script against fresh HTML. That combination looks like a page that
loads and then does nothing, and it survives both a hard reload and restarting the
server, because the staleness is entirely browser-side.
"""

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "GET" in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"serving http://localhost:{port}/  (no-store, so reloads are honest)")
    ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler).serve_forever()
