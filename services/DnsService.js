const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BIND_CONF = '/etc/bind/named.conf.local';
const ZONES_DIR = '/etc/bind/zones';

class DnsService {

    static _ensureZonesDir() {
        if (!fs.existsSync(ZONES_DIR)) {
            fs.mkdirSync(ZONES_DIR, { recursive: true });
        }
    }

    static listZones() {
        try {
            this._ensureZonesDir();
            if (!fs.existsSync(BIND_CONF)) return [];

            const content = fs.readFileSync(BIND_CONF, 'utf8');
            const zones = [];
            const zoneRegex = /zone\s+"([^"]+)"\s*\{[^}]*type\s+(master|slave);[^}]*file\s+"([^"]+)";[^}]*\}/g;
            let match;

            while ((match = zoneRegex.exec(content)) !== null) {
                const zoneFile = path.resolve('/etc/bind', match[2]);
                const fileExists = fs.existsSync(zoneFile);
                let recordCount = 0;

                if (fileExists) {
                    try {
                        const zoneContent = fs.readFileSync(zoneFile, 'utf8');
                        recordCount = (zoneContent.match(/^(?!;|\s*$|\$).+/gm) || []).length;
                    } catch {}
                }

                zones.push({
                    name: match[1],
                    type: match[2],
                    file: match[2],
                    fileExists,
                    recordCount
                });
            }

            return zones;
        } catch (err) {
            console.error('listZones error:', err.message);
            return [];
        }
    }

    static getZoneRecords(domain) {
        try {
            const zoneFile = path.join(ZONES_DIR, domain + '.db');
            if (!fs.existsSync(zoneFile)) {
                return { records: [], soa: null, raw: '' };
            }

            const content = fs.readFileSync(zoneFile, 'utf8');
            const lines = content.split('\n');
            const records = [];
            let soa = null;

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('$')) continue;

                if (trimmed.includes('SOA')) {
                    const soaMatch = trimmed.match(/(\S+)\s+\d+\s+IN\s+SOA\s+(\S+)\s+(\S+)\s*\(\s*(.*)/s);
                    if (soaMatch) {
                        const soaBody = soaMatch[4] || '';
                        const soaNumbers = soaBody.match(/(\d+)/g) || [];
                        soa = {
                            mname: soaMatch[2],
                            rname: soaMatch[3],
                            serial: parseInt(soaNumbers[0]) || 1,
                            refresh: parseInt(soaNumbers[1]) || 3600,
                            retry: parseInt(soaNumbers[2]) || 900,
                            expire: parseInt(soaNumbers[3]) || 604800,
                            minimum: parseInt(soaNumbers[4]) || 86400
                        };
                    }
                    continue;
                }

                if (trimmed.match(/NS\s+/)) continue;

                const parts = trimmed.split(/\s+/);
                if (parts.length >= 4) {
                    records.push({
                        name: parts[0],
                        ttl: parts[1],
                        type: parts[2] || 'A',
                        value: parts.slice(3).join(' ').replace(/;.*$/, '').trim()
                    });
                }
            }

            return { records, soa, raw: content };
        } catch (err) {
            console.error('getZoneRecords error:', err.message);
            return { records: [], soa: null, raw: '' };
        }
    }

    static createZone(domain, type) {
        this._ensureZonesDir();

        const zones = this.listZones();
        if (zones.find(z => z.name === domain)) {
            throw new Error('Zone already exists');
        }

        const now = new Date();
        const serial = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + '01';

        const zoneFile = path.join(ZONES_DIR, domain + '.db');
        const zoneContent = `$TTL 86400
@   IN  SOA ns1.${domain}. admin.${domain}. (
            ${serial}   ; Serial
            3600        ; Refresh
            900         ; Retry
            604800      ; Expire
            86400       ; Minimum TTL
)
@       IN  NS      ns1.${domain}.
ns1     IN  A       ${this._getServerIp()}
@       IN  A       ${this._getServerIp()}
@       IN  MX  10  mail.${domain}.
mail    IN  A       ${this._getServerIp()}
www     IN  CNAME   ${domain}.
`;

        fs.writeFileSync(zoneFile, zoneContent, 'utf8');

        const entry = `\nzone "${domain}" {\n    type ${type || 'master'};\n    file "${domain}.db";\n};\n`;

        if (fs.existsSync(BIND_CONF)) {
            const conf = fs.readFileSync(BIND_CONF, 'utf8');
            fs.writeFileSync(BIND_CONF, conf + entry, 'utf8');
        } else {
            fs.writeFileSync(BIND_CONF, entry, 'utf8');
        }

        this.reloadBind();
        return { success: true };
    }

    static deleteZone(domain) {
        if (!fs.existsSync(BIND_CONF)) throw new Error('BIND config not found');

        const content = fs.readFileSync(BIND_CONF, 'utf8');
        const regex = new RegExp(`\\n?zone\\s+"${domain.replace(/\./g, '\\.')}"\\s*\\{[^}]*\\};`, 'g');
        const newContent = content.replace(regex, '');

        if (newContent === content) throw new Error('Zone not found');

        fs.writeFileSync(BIND_CONF, newContent, 'utf8');

        const zoneFile = path.join(ZONES_DIR, domain + '.db');
        if (fs.existsSync(zoneFile)) fs.unlinkSync(zoneFile);

        this.reloadBind();
        return { success: true };
    }

    static addRecord(domain, name, ttl, type, value) {
        const zoneFile = path.join(ZONES_DIR, domain + '.db');
        if (!fs.existsSync(zoneFile)) throw new Error('Zone file not found');

        const record = `${name.padEnd(20)} ${ttl || '3600'} IN ${type} ${value}`;
        const content = fs.readFileSync(zoneFile, 'utf8');

        const newContent = content.trimEnd() + '\n' + record + '\n';
        fs.writeFileSync(zoneFile, newContent, 'utf8');

        this._incrementSerial(domain);
        this.reloadBind();
        return { success: true };
    }

    static deleteRecord(domain, name, type, value) {
        const zoneFile = path.join(ZONES_DIR, domain + '.db');
        if (!fs.existsSync(zoneFile)) throw new Error('Zone file not found');

        const content = fs.readFileSync(zoneFile, 'utf8');
        const lines = content.split('\n');
        let found = false;

        const filtered = lines.filter(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('$') || trimmed.includes('SOA') || trimmed.includes('NS')) {
                return true;
            }
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 4 && parts[0] === name && parts[2] === type && parts.slice(3).join(' ') === value) {
                found = false; // actually set to true to remove
                return false;
            }
            return true;
        });

        if (!found) {
            const recordLine = `${name.padEnd(20)} IN ${type} ${value}`;
            const idx = lines.findIndex(l => l.trim().includes(name) && l.trim().includes(type) && l.trim().includes(value));
            if (idx !== -1) {
                lines.splice(idx, 1);
                fs.writeFileSync(zoneFile, lines.join('\n'), 'utf8');
                this._incrementSerial(domain);
                this.reloadBind();
                return { success: true };
            }
            throw new Error('Record not found');
        }

        fs.writeFileSync(zoneFile, filtered.join('\n'), 'utf8');
        this._incrementSerial(domain);
        this.reloadBind();
        return { success: true };
    }

    static _incrementSerial(domain) {
        const zoneFile = path.join(ZONES_DIR, domain + '.db');
        if (!fs.existsSync(zoneFile)) return;

        const content = fs.readFileSync(zoneFile, 'utf8');
        const now = new Date();
        const newSerial = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + '01';

        const newContent = content.replace(/(\d{10})\s*;\s*Serial/, newSerial + ' ; Serial');
        fs.writeFileSync(zoneFile, newContent, 'utf8');
    }

    static _getServerIp() {
        try {
            const output = execSync("hostname -I | awk '{print $1}'", { encoding: 'utf8' }).trim();
            return output || '0.0.0.0';
        } catch {
            return '0.0.0.0';
        }
    }

    static reloadBind() {
        try {
            execSync('rndc reload 2>/dev/null || systemctl reload bind9 2>/dev/null || systemctl reload named 2>/dev/null', { encoding: 'utf8' });
            return true;
        } catch {
            return false;
        }
    }

    static checkBindStatus() {
        try {
            const active = execSync('systemctl is-active bind9 2>/dev/null || systemctl is-active named 2>/dev/null', { encoding: 'utf8' }).trim();
            return active === 'active';
        } catch {
            return false;
        }
    }

    static getDnsRecords(domain) {
        try {
            const output = execSync(`dig ${domain} ANY +noall +answer 2>/dev/null`, { encoding: 'utf8' });
            return output.trim();
        } catch {
            return '';
        }
    }

    static importFromWebsite(domain, ip) {
        this._ensureZonesDir();

        const zones = this.listZones();
        if (zones.find(z => z.name === domain)) {
            throw new Error('Zone already exists');
        }

        const now = new Date();
        const serial = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + '01';

        const zoneFile = path.join(ZONES_DIR, domain + '.db');
        const serverIp = ip || this._getServerIp();
        const zoneContent = `$TTL 86400
@   IN  SOA ns1.${domain}. admin.${domain}. (
            ${serial}   ; Serial
            3600        ; Refresh
            900         ; Retry
            604800      ; Expire
            86400       ; Minimum TTL
)
@       IN  NS      ns1.${domain}.
ns1     IN  A       ${serverIp}
@       IN  A       ${serverIp}
@       IN  MX  10  mail.${domain}.
mail    IN  A       ${serverIp}
www     IN  CNAME   ${domain}.
`;

        fs.writeFileSync(zoneFile, zoneContent, 'utf8');

        const entry = `\nzone "${domain}" {\n    type master;\n    file "${domain}.db";\n};\n`;

        if (fs.existsSync(BIND_CONF)) {
            const conf = fs.readFileSync(BIND_CONF, 'utf8');
            fs.writeFileSync(BIND_CONF, conf + entry, 'utf8');
        } else {
            fs.writeFileSync(BIND_CONF, entry, 'utf8');
        }

        this.reloadBind();
        return { success: true };
    }
}

module.exports = DnsService;
