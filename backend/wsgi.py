"""
Raphragrance — WSGI entrypoint for Gunicorn.
Usage: gunicorn wsgi:app -b 0.0.0.0:8080 -w 4
"""
from app import create_app

app = create_app()

if __name__ == "__main__":
    import os
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
