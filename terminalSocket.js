const TerminalService = require('./services/TerminalService');

let pty = null;
try {
    pty = require('node-pty');
} catch (e) {
    console.warn('node-pty not available, terminal will not work');
}

function initTerminalSocket(io) {
    if (!pty) {
        console.warn('Terminal disabled: node-pty not installed');
        return;
    }

    io.on('connection', (socket) => {
        console.log('Terminal client connected');

        let term = null;

        socket.on('terminal:create', () => {
            if (term) {
                term.kill();
            }

            const shell = TerminalService.getDefaultShell();
            const cwd = TerminalService.getCwd();
            const env = TerminalService.getEnv();

            term = pty.spawn(shell, [], {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: cwd,
                env: env
            });

            console.log('Terminal spawned:', shell, 'PID:', term.pid);

            term.onData((data) => {
                socket.emit('terminal:data', data);
            });

            term.onExit(({ exitCode }) => {
                console.log('Terminal exited:', exitCode);
                socket.emit('terminal:exit', { exitCode });
                term = null;
            });

            socket.emit('terminal:created', { pid: term.pid, shell: shell });
        });

        socket.on('terminal:data', (data) => {
            if (term) {
                term.write(data);
            }
        });

        socket.on('terminal:resize', ({ cols, rows }) => {
            if (term) {
                try {
                    term.resize(cols, rows);
                } catch (e) {}
            }
        });

        socket.on('terminal:kill', () => {
            if (term) {
                term.kill();
                term = null;
            }
        });

        socket.on('disconnect', () => {
            console.log('Terminal client disconnected');
            if (term) {
                term.kill();
                term = null;
            }
        });
    });
}

module.exports = { initTerminalSocket };
