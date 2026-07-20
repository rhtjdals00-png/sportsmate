# ==========================================
# Stage 1: Build the React frontend
# ==========================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app

# Copy the frontend source code
COPY frontend/ ./frontend/

# Install dependencies and build the frontend
# Using npm install instead of ci to be safe if package-lock is out of sync
RUN cd frontend && npm install && npm run build

# ==========================================
# Stage 2: Build the Python backend and serve
# ==========================================
FROM python:3.12-slim

# Install Nginx and Supervisor for process management
RUN apt-get update && apt-get install -y nginx supervisor && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend requirements and install them
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the rest of the backend source code
COPY backend/ ./backend/

# Copy the built frontend static files to Nginx's default directory
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# ------------------------------------------
# Configure Nginx
# ------------------------------------------
# This configuration sets up Nginx to serve the React SPA and proxy /api/ requests to Gunicorn
RUN echo 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # SPA fallback for React Router\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    # Reverse proxy for backend API\n\
    location /api/ {\n\
        proxy_pass http://127.0.0.1:5000;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto $scheme;\n\
    }\n\
}' > /etc/nginx/sites-available/default

# ------------------------------------------
# Configure Supervisor
# ------------------------------------------
# Supervisor runs both Nginx and Gunicorn in the foreground within the same container
RUN echo '[supervisord]\n\
nodaemon=true\n\
\n\
[program:nginx]\n\
command=nginx -g "daemon off;"\n\
autostart=true\n\
autorestart=true\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n\
\n\
[program:gunicorn]\n\
directory=/app/backend\n\
command=gunicorn -b 127.0.0.1:5000 run:app\n\
autostart=true\n\
autorestart=true\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n' > /etc/supervisor/conf.d/supervisord.conf

# Expose port 80 for Nginx
EXPOSE 80

# Run Supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
