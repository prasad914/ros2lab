#!/usr/bin/env python3
"""Local dev server for public/ (npm run dev), like `python3 -m http.server`, plus `Cache-Control: no-cache`.

The plain http.server sends only Last-Modified, so a browser may keep using JS modules it fetched before a
`git checkout` or merge. A page then mixes old and new modules (for example an old dom.js without placeError),
the import fails and the page stays on "Loading…". Firebase Hosting already sends no-cache for html/js/css/json
(firebase.json); this does the same for every file locally, so the browser always revalidates.

Usage: python3 tools/dev-server.py [port] [directory]      (defaults: 8000, public)
"""
import functools
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    directory = sys.argv[2] if len(sys.argv) > 2 else "public"
    handler = functools.partial(NoCacheHandler, directory=directory)
    http.server.test(HandlerClass=handler, ServerClass=http.server.ThreadingHTTPServer, port=port, bind="0.0.0.0")


if __name__ == "__main__":
    main()
