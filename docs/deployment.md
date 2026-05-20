# Deployment Guide

This guide covers deploying the IPTV Manager to an Ubuntu 24.04 LTS server.

## Prerequisites

1. Ubuntu 24.04 LTS Server (Minimum 1GB RAM, 20GB Disk)
2. Domain name pointed to your server's IP (e.g., `kukey.com` and `iptv.kukey.com`)
3. SSH access with sudo privileges

## 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install -y curl wget git ufw fail2ban

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

*Log out and log back in to apply Docker group changes.*

## 2. Clone and Configure

```bash
# Clone the repository
git clone <repository_url> iptv-manager
cd iptv-manager

# Copy the environment file
cp .env.example .env
```

**Edit `.env` critically:**
Use `nano .env` and update all placeholders (passwords, JWT secrets, session secrets).
Make sure to set `APP_URL` to your admin panel domain (e.g., `https://iptv.kukey.com`) and `PUBLIC_URL` to your public domain (e.g., `https://kukey.com`).

*Tip to generate secure secrets:*
```bash
openssl rand -hex 32
```

## 3. Initial Deployment (Without SSL)

We first need to start the NGINX proxy on port 80 to allow Let's Encrypt to verify the domain.

```bash
docker compose up -d nginx frontend api postgres redis worker
```

## 4. Obtain SSL Certificates (Certbot)

Run certbot to get certificates for both your main domain and IPTV admin domain.

```bash
# Run a temporary certbot container
docker run -it --rm --name certbot \
  -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot-webroot:/var/www/certbot" \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d kukey.com -d www.kukey.com -d iptv.kukey.com \
  --email your-email@example.com --agree-tos --no-eff-email
```

## 5. Enable SSL in NGINX

Once certificates are obtained successfully:

1. Edit `nginx/conf.d/default.conf`
2. Uncomment the port 443 (SSL) blocks for both `kukey.com` and `iptv.kukey.com`.
3. Uncomment the HTTP to HTTPS redirect (`return 301 https://$host$request_uri;`) in the port 80 blocks.
4. Restart NGINX:

```bash
docker compose restart nginx
```

## 6. Create the Admin User

Now that the app is running securely, create your initial administrator account.

```bash
docker compose exec api node dist/cli/create-admin.js
```

Follow the prompts.

## 7. Next Steps

- Access `https://iptv.kukey.com`
- Log in with the credentials you just created.
- You will be immediately prompted to set up TOTP (2FA) using Google Authenticator or Authy.
- Review `docs/security.md` for firewall and system hardening.
