const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PhpService {

    static getVersion() {
        try {
            return execSync('php -v 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
        } catch {
            return 'Not installed';
        }
    }

    static getInfo() {
        try {
            const output = execSync('php -i 2>/dev/null', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
            const lines = output.split('\n');
            const info = {};
            for (const line of lines) {
                const match = line.match(/^(\w[\w\s]*?)\s*=>\s*(.*)/);
                if (match) {
                    info[match[1].trim()] = match[2].trim();
                }
            }
            return info;
        } catch {
            return {};
        }
    }

    static getModules() {
        try {
            const output = execSync('php -m 2>/dev/null', { encoding: 'utf8' });
            return output.split('\n').filter(m => m.trim() && !m.startsWith('[')).map(m => m.trim());
        } catch {
            return [];
        }
    }

    static getLoadedModules() {
        try {
            const output = execSync('php -m 2>/dev/null', { encoding: 'utf8' });
            return output.split('\n').filter(m => m.trim() && !m.startsWith('[')).map(m => m.trim());
        } catch {
            return [];
        }
    }

    static getPhpIniPath() {
        try {
            const output = execSync('php --ini 2>/dev/null', { encoding: 'utf8' });
            const match = output.match(/Loaded Configuration File:\s*(.*)/);
            return match ? match[1].trim() : null;
        } catch {
            return null;
        }
    }

    static getIniSettings() {
        const iniPath = this.getPhpIniPath();
        if (!iniPath || !fs.existsSync(iniPath)) return {};

        try {
            const content = fs.readFileSync(iniPath, 'utf8');
            const settings = {};
            const important = [
                'memory_limit', 'upload_max_filesize', 'post_max_size',
                'max_execution_time', 'max_input_time', 'max_file_uploads',
                'display_errors', 'error_reporting', 'date.timezone',
                'session.auto_start', 'session.cookie_lifetime', 'session.gc_maxlifetime',
                'opcache.enable', 'opcache.memory_consumption',
                'mysqli.default_socket', 'pdo_mysql.default_socket'
            ];

            const lines = content.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('[')) continue;
                const match = trimmed.match(/^(\w[\w_.]*?)\s*=\s*(.*)/);
                if (match) {
                    const key = match[1].trim();
                    if (important.includes(key)) {
                        settings[key] = match[2].trim();
                    }
                }
            }
            return settings;
        } catch {
            return {};
        }
    }

    static getFpmPools() {
        try {
            const output = execSync('ls /etc/php/*/fpm/pool.d/ 2>/dev/null || ls /etc/php*/fpm/pool.d/ 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
            if (!output) return [];
            return output.split('\n').filter(f => f.trim()).map(f => f.trim());
        } catch {
            return [];
        }
    }

    static getFpmVersion() {
        try {
            const versions = execSync('ls /etc/php/ 2>/dev/null', { encoding: 'utf8' }).trim().split('\n').filter(v => v.trim());
            return versions.length > 0 ? versions[versions.length - 1] : null;
        } catch {
            return null;
        }
    }

    static getInstalledVersions() {
        try {
            const output = execSync('ls /etc/php/ 2>/dev/null', { encoding: 'utf8' }).trim();
            return output ? output.split('\n').filter(v => v.trim()).map(v => v.trim()) : [];
        } catch {
            return [];
        }
    }

    static getOpCacheStatus() {
        try {
            const output = execSync('php -r "echo json_encode(opcache_get_status(false));" 2>/dev/null', { encoding: 'utf8' });
            return JSON.parse(output);
        } catch {
            return null;
        }
    }

    static getServiceStatus() {
        try {
            const fpmVersion = this.getFpmVersion();
            if (!fpmVersion) return { running: false, version: null };
            const active = execSync(`systemctl is-active php${fpmVersion}-fpm 2>/dev/null`, { encoding: 'utf8' }).trim();
            return { running: active === 'active', version: fpmVersion };
        } catch {
            return { running: false, version: null };
        }
    }

    static restartFpm() {
        try {
            const fpmVersion = this.getFpmVersion();
            if (!fpmVersion) throw new Error('PHP-FPM not found');
            execSync(`systemctl restart php${fpmVersion}-fpm`, { encoding: 'utf8' });
            return { success: true };
        } catch (err) {
            throw new Error('Failed to restart PHP-FPM: ' + err.message);
        }
    }

    static getPhpInfoHtml() {
        try {
            return execSync('php -i 2>/dev/null', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        } catch {
            return '';
        }
    }
}

module.exports = PhpService;
