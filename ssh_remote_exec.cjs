const { Client } = require('ssh2');

const conn = new Client();
const cmd = process.argv[2];

if (!cmd) {
    console.error("Usage: node ssh_remote_exec.cjs <command>");
    process.exit(1);
}

conn.on('ready', () => {
    console.log('Client :: ready');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).connect({
    host: '191.252.100.73',
    port: 22,
    username: 'root',
    password: 'Brunn@80'
});
