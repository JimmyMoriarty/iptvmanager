# Security Hardening Guide

Security is the highest priority for the IPTV Manager. Follow these steps to secure your Ubuntu 24.04 LTS server.

## 1. UFW Firewall Configuration

By default, only allow SSH, HTTP, and HTTPS.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (If you use a custom port, change 'ssh' to your port number)
sudo ufw allow ssh

# Allow web traffic
sudo ufw allow http
sudo ufw allow https

# Enable firewall
sudo ufw enable
```

## 2. Fail2ban Setup

Fail2ban will monitor your logs and ban IP addresses that show malicious signs, such as too many password failures.

1. Ensure it is installed: `sudo apt install fail2ban`
2. Create a local config: `sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local`
3. Edit `sudo nano /etc/fail2ban/jail.local` and enable the SSH jail:
   ```ini
   [sshd]
   enabled = true
   port = ssh
   filter = sshd
   logpath = /var/log/auth.log
   maxretry = 3
   ```
4. Restart Fail2ban: `sudo systemctl restart fail2ban`

## 3. SSH Hardening

Edit your SSH daemon config: `sudo nano /etc/ssh/sshd_config`

Make the following changes to prevent root login and password authentication (assuming you have SSH keys set up):

```text
PermitRootLogin no
PasswordAuthentication no
X11Forwarding no
AllowTcpForwarding no
```

Restart SSH: `sudo systemctl restart sshd`

## 4. Application Level Security (Built-in)

The IPTV Manager application implements several critical security measures internally:

- **SSRF Protection:** The `SafeFetcherService` blocks all private IP ranges (`10.x.x.x`, `192.168.x.x`, `127.x.x.x`, etc.) to prevent the server from scanning your internal network.
- **Strict Headers:** NGINX and NestJS Helmet enforce strict Content Security Policy, HSTS, and prevent Clickjacking via X-Frame-Options.
- **Two-Factor Authentication (TOTP):** Mandatory for all accounts. Secrets are encrypted at rest using AES-256-GCM.
- **Non-Root Docker:** The Dockerfile runs the Node.js application as a restricted `nextjs`/`appuser` account, preventing privilege escalation inside the container.
- **Audit Logging:** Every critical action (login, token refresh, playlist creation) is logged in the `AuditLog` table.

## 5. Cloudflare (Optional but Recommended)

For maximum security against DDoS attacks and exposing your origin IP:

1. Proxy your DNS records (`kukey.com` and `iptv.kukey.com`) through Cloudflare (Orange cloud).
2. Set SSL/TLS encryption mode to **Full (strict)**.
3. Use UFW to only allow traffic from Cloudflare IP ranges.
