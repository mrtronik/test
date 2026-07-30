#!/bin/bash
# mrpanel.sh - Install MR Panel application

banner "Langkah ke 6 dari 8: Instalasi MR Panel"

PANEL_DIR="/opt/mrpanel"

# langkah 6 point 1
if [ -n "$PROJECT_DIR" ] && [ -d "$PROJECT_DIR" ]; then
    proses "Menyalin MR Panel dari $PROJECT_DIR ..."
    mkdir -p "$PANEL_DIR"
    # Copy everything except node_modules and .git
    rsync -a --exclude='node_modules' --exclude='.git' --exclude='.env' "$PROJECT_DIR/" "$PANEL_DIR/"
    sukses "File tersalin ke $PANEL_DIR"
elif [ -d "$PANEL_DIR" ]; then
    sukses "MR Panel sudah ada di $PANEL_DIR"
else
    err "No source directory found. Use --src /path/to/project or copy files to $PANEL_DIR"
fi

cd "$PANEL_DIR"

# langkah 6 point 2
proses "Menginstall Library yang dibutuhkan..."
npm install --production >> "$LOG_FILE" 2>&1
sukses "Library telah Aktif"

# Create .env
if [ ! -f .env ]; then
    proses "Membuat Konfigurasi..."

    DB_PASSWORD="${MYSQL_ROOT_PASS}"
    PUBLIC_IP="${PUBLIC_IP:-localhost}"

    cat > .env << ENVEOF
APP_NAME=MR Panel
APP_ENV=local
APP_KEY=${APP_KEY}
APP_URL=http://${PUBLIC_IP}:${PANEL_PORT}
SESSION_LIFETIME=1440
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=${DB_PASSWORD}
DB_DATABASE=belajar_node
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
ENVEOF

    chmod 600 .env
    sukses "Konfigurasi Aktif"
fi

# langkah 6 point 3
proses "Penyiapan Database MR Panel..."
node database/migrate.js >> "$LOG_FILE" 2>&1 || warn "Users migration may have failed"
node database/migrate-websites.js >> "$LOG_FILE" 2>&1 || warn "Websites migration may have failed"
node database/migrate-session.js >> "$LOG_FILE" 2>&1 || warn "Session migration may have failed"
node database/migrate-email-accounts.js >> "$LOG_FILE" 2>&1 || warn "Email accounts migration may have failed"
node database/migrate-cache.js >> "$LOG_FILE" 2>&1 || warn "Cache migration may have failed"
node database/seed.js >> "$LOG_FILE" 2>&1 || warn "Cache migration may have failed"
sukses "Database Siap Digunakan"

# langkah 6 point 4
proses "Penyiapan Plugin MR Cache..."
mkdir -p "$PANEL_DIR/plugins"
sukses "Plugin MR Cache Aktif"

# langkah 6 point 5
proses "Konfigurasi MR Runtime Manager ..."
pm2 delete mrpanel >> "$LOG_FILE" 2>&1 || true
cd "$PANEL_DIR"
pm2 start app.js --name mrpanel --max-memory-restart 256M >> "$LOG_FILE" 2>&1
pm2 save >> "$LOG_FILE" 2>&1
sukses "MR Runtime Manager Aktif"

# langkah 6 point 6
pm2 startup systemd -u root --hp /root >> "$LOG_FILE" 2>&1 || true
pm2 save >> "$LOG_FILE" 2>&1

# langkah 6 point 7
chown -R lsadm:nogroup "$PANEL_DIR/plugins" 2>/dev/null || true

sukses "MR Panel terinstall di $PANEL_DIR"
echo ""
