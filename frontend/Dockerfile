FROM node:22-alpine AS build

WORKDIR /app

# 패키지 정보 복사 및 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 복사 및 빌드
COPY . .
RUN npm run build

# Nginx로 정적 서빙 및 리버스 프록시 설정
FROM nginx:alpine

# 빌드된 정적 파일 복사
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx SPA 라우팅 및 백엔드(api) 프록시 설정
RUN echo 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    location /api/ {\n\
        proxy_pass http://backend:5000;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto $scheme;\n\
    }\n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
