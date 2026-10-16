# Production Deployment Guide (AWS EC2 & GitHub Actions)

This document provides instructions for deploying the Centralized Exchange backend stack to an AWS EC2 instance using Docker Compose and GitHub Actions CI/CD.

---

## Architecture Overview

```
[ Developer ] ──▶ Push to `main` ──▶ [ GitHub Actions CI/CD ]
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
         [ Build & Validate ]                                [ Publish to Docker Hub ]
         bun lint / typecheck                                6 microservice images
                    │                                                   │
                    └─────────────────────────┬─────────────────────────┘
                                              ▼
                                    [ Deploy to AWS EC2 ]
                                    1. SCP docker-compose.prod.yml to EC2
                                    2. SSH: docker compose pull && up -d
                                              │
                                              ▼
                                    [ AWS EC2 Instance ]
                                    ├── Nginx Reverse Proxy (SSL / HTTPS)
                                    ├── Next.js Debug Console (PM2 :3002)
                                    └── Docker Compose Stack:
                                        ├── TimescaleDB (Postgres :5432)
                                        ├── Redis 7.4 (:6379)
                                        ├── cex-backend (:8080)
                                        ├── cex-trading-engine (:8081)
                                        ├── cex-database-engine (:8082)
                                        ├── cex-ws-server (:8083)
                                        ├── cex-ws-index-poller (:8084)
                                        └── cex-proxy-server (:8085)
```

---

## 1. AWS EC2 Instance Requirements

* **Recommended Instance Type:** `t3.medium` (2 vCPU, 4GB RAM) or `t3.large` (8GB RAM).
* **Storage:** 30GB+ gp3 SSD.
* **Operating System:** Ubuntu 24.04 LTS or 22.04 LTS.
* **Security Group Inbound Rules:**
  * Port `22` (SSH) — Remote access and GitHub Actions runner.
  * Port `80` (HTTP) — Web traffic & Certbot ACME challenges.
  * Port `443` (HTTPS) — Secure API & WebSocket traffic.
  * *(Keep ports 5432, 6379, 8080-8085 closed to the public; they are internal to localhost and the Docker network).*

---

## 2. Server Setup (One-Time)

### A. Swap Space & Docker Installation
```bash
sudo apt-get update && sudo apt-get upgrade -y

# 4GB Swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Docker & Docker Compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
newgrp docker
```

### B. Deployment Directory & Environment Configuration
```bash
mkdir -p /home/ubuntu/opt/cex/infra
nano /home/ubuntu/opt/cex/.env.production
```

Add your production environment variables:
```env
# Docker Image Names
BACKEND_NAME=<your-dockerhub-user>/cex-backend
TRADE_ENGINE_NAME=<your-dockerhub-user>/cex-trading-engine
DATABASE_ENGINE_NAME=<your-dockerhub-user>/cex-database-engine
WS_SERVER_NAME=<your-dockerhub-user>/cex-ws-server
WS_POLLER_NAME=<your-dockerhub-user>/cex-ws-index-poller
PROXY_SERVER_NAME=<your-dockerhub-user>/cex-proxy-server
IMAGE_TAG=latest

# Database & Redis Credentials
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_postgres_password
POSTGRES_DB=cex
REDIS_PASSWORD=your_secure_redis_password

# Core Backend Secrets
PORT=8080
JWT_ACCESS_SECRET=your_jwt_access_secret_hex
JWT_REFRESH_SECRET=your_jwt_refresh_secret_hex
JWT_PASSWORD_REFRESH_SECRET=your_jwt_password_refresh_secret_hex
JWT_OTP_SECRET=your_jwt_otp_secret_hex
ADMIN_KEY=your_admin_secret_key
BCRYPT_SALT_ROUNDS=10
FRONTEND_URL=https://debug.yourdomain.com
RESEND_API_KEY=re_placeholder
MAIL_FROM=support@yourdomain.com

# Cloudflare R2 / S3 Snapshots
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_r2_bucket_name
R2_BUCKET_ENDPOINT=https://<your_account_id>.r2.cloudflarestorage.com

# Supporting Services
DATABASE_ENGINE_BATCH_SIZE=100
DATABASE_ENGINE_BLOCK_TIME_MS=2000
WS_PORT=8083
WS_SERVER_BATCH_SIZE=100
WS_SERVER_BLOCK_TIME_MS=2000
STALE_AFTER_MS=10000
FUNDING_INTERVAL_SECONDS=3600
BINANCE_MARK_PRICE_STREAM_URL=wss://fstream.binance.com/market/ws/!markPrice@arr@1s
```
Secure the permissions:
```bash
chmod 600 /home/ubuntu/opt/cex/.env.production
```

---

## 3. GitHub Actions CI/CD Configuration

In your GitHub repository, navigate to **Settings > Secrets and variables > Actions**:

### Repository Variables:
* `DOCKERHUB_USERNAME`: Your Docker Hub username.

### Repository Secrets:
* `DOCKERHUB_TOKEN`: Personal Access Token from Docker Hub (Read/Write permissions).
* `DATABASE_URL`: `postgresql://postgres:postgres@localhost:5432/cex` (Used for CI build-time verification).
* `EC2_HOST`: Elastic IP address of your EC2 instance.
* `EC2_USER`: `ubuntu`
* `EC2_SSH_KEY`: Full private SSH key (`.pem`) used to connect to your EC2 instance.

---

## 4. Nginx Reverse Proxy & SSL Configuration

Create `/etc/nginx/sites-available/cex.conf`:

```nginx
# Backend API & WebSocket Gateway
server {
    server_name api.yourdomain.com;

    location /core/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /engine/ {
        proxy_pass http://127.0.0.1:8081/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /database/ {
        proxy_pass http://127.0.0.1:8082/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /poller/ {
        proxy_pass http://127.0.0.1:8084/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /proxy/ {
        proxy_pass http://127.0.0.1:8085/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8083/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location = /ws {
        proxy_pass http://127.0.0.1:8083/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    listen 80;
}

# Next.js Debug Console
server {
    server_name debug.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 80;
}
```

Enable the configuration and obtain SSL certificates via Certbot:
```bash
sudo ln -s /etc/nginx/sites-available/cex.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

sudo certbot --nginx -d api.yourdomain.com -d debug.yourdomain.com
```

---

## 5. Running Debug Console on EC2

To host the debug console with PM2 on port 3002:

```bash
cd /home/ubuntu
git clone https://github.com/Devashish-Belwal/CryptoExchange.git app
cd /home/ubuntu/app

# Install PM2
sudo npm install -g pm2

# Configure environment
cat << 'EOF' > apps/debug-console/.env.production
PORT=3002
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
NEXT_PUBLIC_CORE_WS_URL=wss://api.yourdomain.com/ws
NEXT_PUBLIC_DEBUG_URL=https://debug.yourdomain.com
EOF

# Build and start
bun install
bun run --cwd apps/debug-console build
pm2 start "bun run --cwd apps/debug-console start -- -p 3002" --name debug-console
pm2 save
pm2 startup
```

---

## 6. Database Migrations (One-Time Setup)

Once the backend containers are launched on EC2:
```bash
cd /home/ubuntu/opt/cex
docker compose -f infra/docker-compose.prod.yml --env-file .env.production run --rm backend bun run --cwd packages/database db:migrate:deploy
```
