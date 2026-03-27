const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  // Read and log the current nginx config
  conn.exec('cat /etc/nginx/sites-available/betmind-ai', (err, stream) => {
    let out = '';
    stream.on('data', d => { out += d; });
    stream.on('close', () => {
      console.log('Current config:\n', out);
      
      // Remove any add_header lines for CORS from nginx config
      // Use Python to do the replacement cleanly
      const fixCmd = `python3 -c "
import re
with open('/etc/nginx/sites-available/betmind-ai', 'r') as f:
    content = f.read()

# Remove any CORS add_header lines
content = re.sub(r\"\\s*add_header 'Access-Control[^']*'[^;]*;\\n?\", '', content)
content = re.sub(r\"\\s*add_header 'Vary'[^;]*;\\n?\", '', content)

with open('/etc/nginx/sites-available/betmind-ai', 'w') as f:
    f.write(content)
print('Done removing CORS headers from nginx')
print('New content:')
print(content)
"`;
      conn.exec(fixCmd, (err2, stream2) => {
        stream2.on('data', d => process.stdout.write(d.toString()));
        stream2.stderr.on('data', d => process.stderr.write(d.toString()));
        stream2.on('close', () => {
          conn.exec('nginx -t && systemctl reload nginx', (err3, stream3) => {
            stream3.on('data', d => process.stdout.write(d.toString()));
            stream3.stderr.on('data', d => process.stderr.write(d.toString()));
            stream3.on('close', () => {
              console.log('\n✅ Nginx reloaded');
              conn.end();
            });
          });
        });
      });
    });
  });
}).connect({ host: '191.252.100.73', port: 22, username: 'root', password: 'Brunn@80' });
