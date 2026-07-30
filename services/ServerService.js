const os = require('os');
const { execFile } = require('child_process');

class ServerService {

    static ram() {

        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;

        return {
            total,
            free,
            used,
            percent: Number(((used / total) * 100).toFixed(1))
        };

    }

    static cpu() {

        const cpus = os.cpus();
        const load = os.loadavg();
        const cores = cpus.length;

        return {
            model: cpus[0].model,
            cores: cores,
            load: load,
            percent: Number(((load[0] / cores) * 100).toFixed(1))
        };

    }

    static uptime() {

        const sec = os.uptime();

        const day = Math.floor(sec / 86400);
        const hour = Math.floor((sec % 86400) / 3600);
        const minute = Math.floor((sec % 3600) / 60);

        return `${day} Days ${hour} Hours ${minute} Minutes`;

    }

    static hostname() {

        return os.hostname();

    }

    static platform() {

        return {
            os: os.platform(),
            release: os.release(),
            arch: os.arch()
        };

    }

    static disk() {

        return new Promise((resolve) => {

            execFile('df', ['-k', '/'], (err, stdout) => {

                if (err)
                    return resolve(null);

                const rows = stdout.trim().split('\n');

                const data = rows[1].split(/\s+/);

                resolve({

                    total: Number(data[1]) * 1024,

                    used: Number(data[2]) * 1024,

                    free: Number(data[3]) * 1024,

                    percent: data[4]

                });

            });

        });

    }

}

module.exports = ServerService;