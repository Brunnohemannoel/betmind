const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `curl -s -X POST http://127.0.0.1:8000/analyze -H "Content-Type: application/json" -d '{"match_id":"test"}' | head -c 300; echo ""; curl -s http://127.0.0.1:8000/health; echo ""; systemctl is-active betmind-ai; ss -tlnp | grep 8000`;
  conn.exec(cmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', err => console.error('SSH error:', err.message))
  .connect({ 
    host: '191.252.100.73', port: 22, username: 'root', password: 'Brunn@80',
    readyTimeout: 30000
  });
