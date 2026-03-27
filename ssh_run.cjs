
const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(process.argv[2], (err, stream) => {
    if (err) throw err;
    stream.on('data', (data) => process.stdout.write(data));
    stream.stderr.on('data', (data) => process.stderr.write(data));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '191.252.100.73', port: 22, username: 'root', password: 'Brunn@80'
});
