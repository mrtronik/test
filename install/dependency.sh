#!/bin/bash
# ══════════════════════════════════════════════
#  dependency.sh — Install system dependencies
# ══════════════════════════════════════════════

banner "Langkah ke 2 dari 8: Dependensi Sistem"

export DEBIAN_FRONTEND=noninteractive

# ─── Update system ────────────────────────────
proses "Memperbarui Paket Sistem..."
apt-get update -qq >> "$LOG_FILE" 2>&1
apt-get upgrade -y -qq >> "$LOG_FILE" 2>&1
sukses "Paket Sistem Berhasil Diperbarui"
# ─── Essential packages ───────────────────────
proses "Menginstall Paket Yang Diperlukan.."
PACKAGES=(
    curl wget git unzip zip software-properties-common
    build-essential gcc g++ make
    python3 python3-pip
    cron logrotate
    net-tools lsof htop tmux
    jq
)

apt-get install -y -qq ${PACKAGES[@]} >> "$LOG_FILE" 2>&1
sukses "Paket sudah terinstall"

# ─── Node.js 22.x ────────────────────────────
if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    sukses "Sistem Core sudah Terinstall"
else
    proses "Menginstall Core Sistem..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >> "$LOG_FILE" 2>&1
    apt-get install -y -qq nodejs >> "$LOG_FILE" 2>&1
    sukses "Core Sistem sudah Terinstall"
fi

# ─── PM2 ──────────────────────────────────────
if command -v pm2 &>/dev/null; then
    sukses "MR Runtime Manager sudah Aktif : $(pm2 --version)"
else
    proses "Menginstall MR Runtime Manager..."
    npm install -g pm2 >> "$LOG_FILE" 2>&1
    sukses "MR Runtime Manager sudah Aktif : $(pm2 --version)"
fi

# ─── WP-CLI ───────────────────────────────────
if [ -f /usr/local/bin/wp ]; then
    sukses "WP-CLI sudah Aktif"
else
    proses "Menginstall WP-CLI..."
    curl -sL https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar -o /usr/local/bin/wp
    chmod +x /usr/local/bin/wp
    sukses "WP-CLI sudah Aktif"
fi

# ─── Certbot ──────────────────────────────────

if command -v certbot &>/dev/null; then
    sukses "Certbot sudah Aktif"
else
    proses "Menginstall Certbot..."
    apt-get install -y -qq certbot >> "$LOG_FILE" 2>&1
    sukses "Certbot sudah Aktif"
fi

echo ""
