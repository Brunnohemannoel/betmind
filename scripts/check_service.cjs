const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('systemctl cat betmind-ai', (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '191.252.100.73', port: 22, username: 'root', password: 'Brunn@80' });
