const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('grep -n "def " /opt/betmind-ai/main.py | head -30', (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => {
      conn.exec('wc -l /opt/betmind-ai/main.py', (err2, stream2) => {
        stream2.on('data', d => process.stdout.write(d.toString()));
        stream2.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '191.252.100.73', port: 22, username: 'root', password: 'Brunn@80' });
