
const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const localFilePath = 'c:\\SITES\\betmind\\nginx_api_utf8.conf';
const remoteFilePath = '/etc/nginx/sites-available/api.torrenettelecom.com.br';
const fileContent = fs.readFileSync(localFilePath, 'utf8');

conn.on('ready', () => {
  // Usar base64 para evitar problemas de escape no shell
  const base64Content = Buffer.from(fileContent).toString('base64');
  const command = `echo "${base64Content}" | base64 -d > ${remoteFilePath} && nginx -t && systemctl reload nginx`;
  
  conn.exec(command, (err, stream) => {
    if (err) throw err;
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', () => {
      console.log('\nNginx atualizado via Base64!');
      conn.end();
    });
  });
}).connect({
  host: '191.252.100.73', port: 22, username: 'root', password: 'Brunn@80'
});
