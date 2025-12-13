# Subscription Expiration Automation

## Overview

This directory contains a cron job configuration to automatically expire subscriptions and clean up Privnode data.

## Setup Instructions

### 1. Install the cron job

The expiration script should run every hour. Add it to your crontab:

```bash
# Open crontab editor
crontab -e

# Add this line (adjust the path to match your installation):
0 * * * * cd /path/to/privnode_subscription_manage && npm run expire-subscriptions >> /var/log/subscription-expiration.log 2>&1
```

### 2. Alternative: systemd timer (Linux)

For systems using systemd, you can use a systemd timer instead of cron:

```bash
# Create service file
sudo nano /etc/systemd/system/subscription-expiration.service
```

```ini
[Unit]
Description=Expire subscriptions and clean Privnode data
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/path/to/privnode_subscription_manage
ExecStart=/usr/bin/npm run expire-subscriptions
User=your-username
Environment="NODE_ENV=production"
```

```bash
# Create timer file
sudo nano /etc/systemd/system/subscription-expiration.timer
```

```ini
[Unit]
Description=Run subscription expiration hourly
Requires=subscription-expiration.service

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
# Enable and start the timer
sudo systemctl daemon-reload
sudo systemctl enable subscription-expiration.timer
sudo systemctl start subscription-expiration.timer

# Check timer status
sudo systemctl status subscription-expiration.timer
```

## Manual Execution

You can also run the expiration script manually:

```bash
npm run expire-subscriptions
```

## What the Script Does

1. **Finds expired subscriptions**: Queries the Platform DB for subscriptions where `current_period_end <= now()`
2. **Marks as expired**: Sets `expired_at` timestamp and updates deployment status to `'expired'`
3. **Cleans Privnode data**: Removes the subscription entry from the Privnode user's `subscription_data` JSON array

## Logging

- Logs are written to stdout/stderr
- When using cron, redirect output to a log file (see crontab example above)
- For systemd, use `journalctl -u subscription-expiration.service` to view logs

## Monitoring

Check the script output regularly to ensure it's working correctly:

```bash
# For cron (if logging to file)
tail -f /var/log/subscription-expiration.log

# For systemd
journalctl -u subscription-expiration.service -f
```
