# IPTV Playlist Management System

A high-security, production-grade IPTV playlist management system built for Ubuntu Server 24.04 LTS.

## ⚠️ Important

This system **NEVER** proxies, relays, restreams, transcodes, caches, or forwards IPTV video traffic. It only manages playlist metadata. Client devices connect directly to original stream URLs.

## Architecture

- **Backend**: NestJS (TypeScript) — REST API, auth, playlist management
- **Frontend**: Next.js (React, TailwindCSS) — Admin dashboard
- **Database**: PostgreSQL — Persistent storage
- **Cache/Queue**: Redis + BullMQ — Background workers
- **Proxy**: NGINX — TLS termination, reverse proxy
- **Deploy**: Docker Compose — Single-command deployment

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your actual values

# 2. Deploy
docker compose up -d

# 3. Create admin user
docker compose exec api node dist/cli/create-admin.js
```

## Documentation

- [Deployment Guide](docs/deployment.md)
- [Security Hardening](docs/security.md)
- [API Documentation](docs/api.md)
- [Backup & Recovery](docs/backup.md)

## License

Private — All rights reserved.
