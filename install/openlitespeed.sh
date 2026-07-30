#!/bin/bash
# ══════════════════════════════════════════════
#  openlitespeed.sh — Install & configure OLS
# ══════════════════════════════════════════════

banner "Langkah ke 5 dari 8: Instalasi WebServer"


# ─── Composer ─────────────────────────────────
if command -v composer &>/dev/null; then
    sukses "Composer sudah Aktif : $(composer --version | head -n 1)"
else
    proses "Menginstall Composer..."

    cd /tmp

    curl -sS https://getcomposer.org/installer -o composer-setup.php >> "$LOG_FILE" 2>&1

    if [ ! -f composer-setup.php ]; then
        error "Gagal download Composer installer"
    fi

    php composer-setup.php --install-dir=/usr/local/bin --filename=composer >> "$LOG_FILE" 2>&1

    rm -f composer-setup.php

    sukses "Composer sudah Aktif : $(composer --version | head -n 1)"
fi


# ─── Bind9 DNS Server ──────────────────────────
if command -v named &>/dev/null; then
    sukses "Bind9 DNS Server sudah Aktif"
else
    proses "Menginstall Bind9 DNS Server..."

    apt-get update >> "$LOG_FILE" 2>&1
    apt-get install -y bind9 bind9-utils bind9-doc >> "$LOG_FILE" 2>&1

    systemctl enable bind9 >> "$LOG_FILE" 2>&1
    systemctl restart bind9 >> "$LOG_FILE" 2>&1

    sukses "Bind9 DNS Server sudah Aktif"
fi


# ─── Install OpenLiteSpeed ─────────────────────
if [ -f /usr/local/lsws/bin/lswsctrl ]; then
    sukses "WebServer sudah Aktif"
else
    proses "Menginstall WebServer..."

    apt-get update >> "$LOG_FILE" 2>&1
    apt-get install -y openlitespeed >> "$LOG_FILE" 2>&1

    sukses "WebServer sudah Aktif"
fi


# ─── Start OpenLiteSpeed ───────────────────────
proses "Menjalankan WebServer..."

systemctl enable lshttpd >> "$LOG_FILE" 2>&1 || true
systemctl restart lshttpd >> "$LOG_FILE" 2>&1 || true

sukses "WebServer sudah Jalan"

# ─── Set admin password ───────────────────────
proses "Membuat password WebServer..."
OLS_ADMIN_PASS=$(openssl rand -hex 8)
cat > /usr/local/lsws/conf/htpasswd << EOF
mrpanel:${OLS_ADMIN_PASS}
EOF
chown lsadm:nogroup /usr/local/lsws/conf/htpasswd
sukses "WebServer Admin password: $OLS_ADMIN_PASS"

# ─── Create vhosts directory ──────────────────
mkdir -p /usr/local/lsws/conf/vhosts
chown -R lsadm:nogroup /usr/local/lsws/conf/vhosts
#log "Vhosts directory ready"

# ─── Create document roots directory ──────────
mkdir -p /home/public_html
chown -R lsadm:nogroup /home/public_html
#log "Document roots directory ready"

# ─── Create default vhost template ────────────
cat > /usr/local/lsws/conf/vhosts/Example/vhconf.conf << 'EOF'
docRoot $VH_ROOT/html/

index {
  useServer               0
  indexFiles              index.php, index.html
}

accessControl {
  deny
  allow *
}

errorlog $VH_ROOT/logs/error.log {
  logLevel                DEBUG
  rollingSize             10M
  useServer               1
}

accessLog $VH_ROOT/logs/access.log {
  compressArchive         0
  logReferer              1
  keepDays                30
  rollingSize             10M
  logUserAgent            1
  useServer               0
}

rewrite {
  enable                  1
  autoLoadHtaccess        1
}
EOF

mkdir -p /usr/local/lsws/conf/vhosts/Example/html
echo "<h1>OpenLiteSpeed is running</h1>" > /usr/local/lsws/conf/vhosts/Example/html/index.html
chown -R lsadm:nogroup /usr/local/lsws/conf/vhosts/Example
#log "Example vhost configured"

# ─── Reload OLS ───────────────────────────────
/usr/local/lsws/bin/lswsctrl reload >> "$LOG_FILE" 2>&1 || true
#log "OLS reloaded"

echo ""
