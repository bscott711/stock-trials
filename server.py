import http.server
import socketserver
import os

PORT = 8000
BASE_PATH = "/version_2/index.html"

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.endswith('.js'):
            # Serve .js files with explicit MIME type
            filepath = self.translate_path(self.path)
            if os.path.exists(filepath):
                self.send_response(200)
                self.send_header('Content-type', 'application/javascript')
                self.send_header('Content-Length', os.path.getsize(filepath))
                self.send_header('Last-Modified', self.date_time_string(os.path.getmtime(filepath)))
                self.end_headers()
                with open(filepath, 'rb') as f:
                    self.wfile.write(f.read())
                print(f"Served {self.path} as application/javascript")
            else:
                self.send_error(404, "File not found")
        else:
            # Default handling for other files
            super().do_GET()

# Create the server
server = socketserver.TCPServer(("", PORT), CustomHandler)
url = f"http://localhost:{PORT}{BASE_PATH}"

print(f"Serving at port {PORT}")
print(f"Click to open: {url}")
print("Press Ctrl+C to stop the server")

try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\nServer stopped by Ctrl+C")
    server.server_close()
finally:
    print("Cleanup complete. Goodbye!")