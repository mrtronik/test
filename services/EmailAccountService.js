const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');

class EmailAccountService {

    static _hashPassword(password) {
        const safePw = password.replace(/'/g, "'\\''");

        // 1) openssl passwd -6 (SHA-512)
        try {
            const hash = execSync(`echo '${safePw}' | openssl passwd -6 -salt "$(openssl rand -base64 16)" -stdin`, { encoding: 'utf8' }).trim();
            if (hash && hash.startsWith('$')) return hash;
        } catch {}

        // 2) openssl passwd -6
        try {
            const hash = execSync(`openssl passwd -6 '${safePw}'`, { encoding: 'utf8' }).trim();
            if (hash && hash.startsWith('$')) return hash;
        } catch {}

        // 3) openssl passwd -1 (MD5)
        try {
            const hash = execSync(`openssl passwd -1 '${safePw}'`, { encoding: 'utf8' }).trim();
            if (hash && hash.startsWith('$')) return hash;
        } catch {}

        // 4) Node.js fallback
        const salt = crypto.randomBytes(16).toString('base64');
        const hash = crypto.createHash('sha256').update(password + salt).digest('base64');
        return `{SHA256}${salt}:${hash}`;
    }

    static _formatQuota(bytes) {
        if (!bytes || bytes === 0) return 'Unlimited';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // =========================
    // LIST DOMAINS (from websites table)
    // =========================
    static async listDomains() {
        const domains = new Set();
        try {
            const [rows] = await db.query('SELECT domain FROM websites');
            rows.forEach(r => { if (r.domain) domains.add(r.domain); });
        } catch {}
        return Array.from(domains);
    }

    // =========================
    // LIST ACCOUNTS
    // =========================
    static async listAccounts(domain) {
        let sql = 'SELECT * FROM email_accounts WHERE status != "deleted"';
        const params = [];
        if (domain) {
            sql += ' AND domain = ?';
            params.push(domain);
        }
        sql += ' ORDER BY created_at DESC';
        const [rows] = await db.query(sql, params);
        return rows;
    }

    // =========================
    // CREATE ACCOUNT
    // =========================
    static async createAccount(email, password, domain, quota) {
        if (!email || !password) throw new Error('Email and password are required');

        if (!email.includes('@')) {
            email = email + '@' + domain;
        }

        const parts = email.split('@');
        if (parts.length !== 2 || !parts[1]) throw new Error('Invalid email format');

        const [existing] = await db.query('SELECT id FROM email_accounts WHERE email = ?', [email]);
        if (existing.length > 0) throw new Error('Account already exists');

        const passwordHash = this._hashPassword(password);
        const quotaBytes = quota ? parseInt(quota) : 0;

        await db.query(
            'INSERT INTO email_accounts (email, username, domain, password_hash, quota, status) VALUES (?, ?, ?, ?, ?, "active")',
            [email, parts[0], parts[1], passwordHash, quotaBytes]
        );

        // Create mailbox directory
        const mailboxBase = '/var/mail/vhosts';
        const mailboxPath = path.join(mailboxBase, parts[1], parts[0]);
        if (!fs.existsSync(mailboxPath)) {
            try {
                execSync(`mkdir -p "${path.join(mailboxPath, 'cur')}" "${path.join(mailboxPath, 'new')}" "${path.join(mailboxPath, 'tmp')}"`);
                execSync(`chown -R mail:mail "${mailboxPath}"`);
            } catch {}
        }

        return { success: true, email };
    }

    // =========================
    // DELETE ACCOUNT
    // =========================
    static async deleteAccount(email) {
        const [result] = await db.query(
            'UPDATE email_accounts SET status = "deleted" WHERE email = ? AND status != "deleted"',
            [email]
        );
        if (result.affectedRows === 0) throw new Error('Account not found');
        return { success: true };
    }

    // =========================
    // CHANGE PASSWORD
    // =========================
    static async changePassword(email, newPassword) {
        if (!email || !newPassword) throw new Error('Email and new password are required');

        const passwordHash = this._hashPassword(newPassword);

        const [result] = await db.query(
            'UPDATE email_accounts SET password_hash = ? WHERE email = ? AND status != "deleted"',
            [passwordHash, email]
        );
        if (result.affectedRows === 0) throw new Error('Account not found');
        return { success: true };
    }

    // =========================
    // TOGGLE ACCOUNT
    // =========================
    static async toggleAccount(email) {
        const [rows] = await db.query('SELECT status FROM email_accounts WHERE email = ? AND status != "deleted"', [email]);
        if (rows.length === 0) throw new Error('Account not found');

        const newStatus = rows[0].status === 'active' ? 'suspended' : 'active';
        await db.query('UPDATE email_accounts SET status = ? WHERE email = ?', [newStatus, email]);
        return { success: true, active: newStatus === 'active' };
    }

    // =========================
    // UPDATE QUOTA
    // =========================
    static async updateQuota(email, quotaBytes) {
        const [result] = await db.query(
            'UPDATE email_accounts SET quota = ? WHERE email = ? AND status != "deleted"',
            [quotaBytes, email]
        );
        if (result.affectedRows === 0) throw new Error('Account not found');
        return { success: true };
    }

    // =========================
    // GET QUOTA (disk usage from mailbox)
    // =========================
    static getQuota(email) {
        try {
            const parts = email.split('@');
            if (parts.length !== 2) return { used: 0, usedFormatted: '0 Bytes' };
            const mailboxPath = path.join('/var/mail/vhosts', parts[1], parts[0]);
            if (!fs.existsSync(mailboxPath)) return { used: 0, usedFormatted: '0 Bytes' };
            const output = execSync(`du -sb "${mailboxPath}" 2>/dev/null || echo "0"`, { encoding: 'utf8' });
            const bytes = parseInt(output.split('\t')[0]) || 0;
            return { used: bytes, usedFormatted: this._formatQuota(bytes) };
        } catch {
            return { used: 0, usedFormatted: '0 Bytes' };
        }
    }

    // =========================
    // GET ACCOUNT INFO
    // =========================
    static async getAccountInfo(email) {
        const [rows] = await db.query('SELECT * FROM email_accounts WHERE email = ? AND status != "deleted"', [email]);
        return rows.length > 0 ? rows[0] : null;
    }
}

module.exports = EmailAccountService;
