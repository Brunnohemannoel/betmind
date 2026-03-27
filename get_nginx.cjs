
const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /etc/nginx/sites-available/api.torrenettelecom.com.br', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', (data) => out += data.toString());
    stream.on('close', () => {
      fs.writeFileSync('c:\\SITES\\betmind\\nginx_api_utf8.conf', out, 'utf8');
      conn.end();
    });
  });
}).connect({
  host: '191.252.100.73', port: 22, username: 'root', password: 'Brunn@80'
});
