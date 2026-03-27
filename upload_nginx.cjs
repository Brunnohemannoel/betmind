
const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const localFile = 'c:\\SITES\\betmind\\nginx_api_utf8.conf';
    const remoteFile = '/etc/nginx/sites-available/api.torrenettelecom.com.br';
    sftp.fastPut(localFile, remoteFile, (err) => {
      if (err) throw err;
      console.log('Upload concluído!');
      conn.exec('nginx -t && systemctl reload nginx', (err, stream) => {
        if (err) throw err;
        stream.on('data', (data) => process.stdout.write(data));
        stream.stderr.on('data', (data) => process.stderr.write(data));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({
  host: '191.252.100.73', port: 22, username: 'root', password: 'Brunn@80'
});
