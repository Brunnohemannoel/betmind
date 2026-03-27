const { Client } = require('ssh2');

const VPS_HOST = '191.252.100.73';
const VPS_USER = 'root';
const VPS_PASS = 'Brunn@80';
const VPS_PORT = 22;

const conn = new Client();
conn.on('ready', () => {
  conn.exec('journalctl -u betmind-ai -n 100 --no-pager', (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: VPS_HOST,
  port: VPS_PORT,
  username: VPS_USER,
  password: VPS_PASS
});
