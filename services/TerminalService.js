const { execSync } = require('child_process');
const os = require('os');

class TerminalService {

    static getDefaultShell() {
        if (process.platform === 'win32') {
            return 'powershell.exe';
        }
        return process.env.SHELL || '/bin/bash';
    }

    static getCwd() {
        return process.env.HOME || os.homedir() || '/root';
    }

    static getEnv() {
        return {
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            LANG: 'en_US.UTF-8',
            PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
        };
    }
}

module.exports = TerminalService;
