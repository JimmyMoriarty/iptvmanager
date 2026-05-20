# Backup & Recovery Guide

## Automated Backups (PostgreSQL)

You should regularly back up the PostgreSQL database, as it contains all users, settings, and playlist configurations.

### Create a Backup Script

Create a script at `/opt/iptv-manager/scripts/backup.sh` (or wherever you cloned the repo).

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/var/backups/iptv"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
DB_USER="iptv_admin"
DB_NAME="iptv_manager"

mkdir -p "$BACKUP_DIR"

# Execute pg_dump inside the docker container
docker exec iptv-manager-postgres-1 pg_dump -U "$DB_USER" "$DB_NAME" -F c -f "/tmp/db_$DATE.dump"

# Copy the dump from the container to the host
docker cp iptv-manager-postgres-1:"/tmp/db_$DATE.dump" "$BACKUP_DIR/db_$DATE.dump"

# Clean up inside container
docker exec iptv-manager-postgres-1 rm "/tmp/db_$DATE.dump"

# Keep only the last 7 days of backups
find "$BACKUP_DIR" -type f -name "db_*.dump" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.dump"
```

Make it executable:
```bash
chmod +x scripts/backup.sh
```

### Schedule with Cron

Run the backup daily at 2:00 AM:

```bash
sudo crontab -e
```

Add the line:
```text
0 2 * * * /path/to/iptv-manager/scripts/backup.sh >> /var/log/iptv_backup.log 2>&1
```

## Restore Procedure

To restore a backup:

1. Stop the application services (keep postgres running):
   ```bash
   docker compose stop api worker frontend
   ```
2. Copy the backup file into the postgres container:
   ```bash
   docker cp /var/backups/iptv/db_2024-01-01_02-00-00.dump iptv-manager-postgres-1:/tmp/restore.dump
   ```
3. Drop and recreate the database, then restore:
   ```bash
   docker exec -it iptv-manager-postgres-1 bash -c "
     dropdb -U iptv_admin iptv_manager;
     createdb -U iptv_admin iptv_manager;
     pg_restore -U iptv_admin -d iptv_manager -1 /tmp/restore.dump
   "
   ```
4. Restart all services:
   ```bash
   docker compose start
   ```
