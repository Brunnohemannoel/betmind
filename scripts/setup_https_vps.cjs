const { Client } = require('ssh2');

const VPS_HOST = '191.252.100.73';
const VPS_USER = 'root';
const VPS_PASS = 'Brunn@80';
const VPS_PORT = 22;

function execSSH(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', d => { out += d; process.stdout.write(d.toString()); });
      stream.stderr.on('data', d => { process.stderr.write(d.toString()); });
      stream.on('close', code => resolve({ code, out }));
    });
  });
}

async function run() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: VPS_HOST, port: VPS_PORT, username: VPS_USER, password: VPS_PASS
    });
  });

  console.log('--- Installing Nginx and Certbot ---');
  await execSSH(conn, 'apt-get update && apt-get install -y nginx certbot python3-certbot-nginx');

  console.log('\n--- Configuring Nginx ---');
  const domain = '191-252-100-73.sslip.io';
  const config = `
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers (redundant but safe)
        add_header 'Access-Control-Allow-Origin' '*' always;
    }
}
`;
  await execSSH(conn, `echo '${config.replace(/'/g, "'\\''")}' > /etc/nginx/sites-available/betmind-ai`);
  await execSSH(conn, 'ln -sf /etc/nginx/sites-available/betmind-ai /etc/nginx/sites-enabled/');
  await execSSH(conn, 'rm -f /etc/nginx/sites-enabled/default');
  await execSSH(conn, 'nginx -t && systemctl restart nginx');

  console.log('\n--- requesting SSL with Certbot ---');
  // Nota: Isso requer que a porta 80 esteja aberta e o sslip.io responda
  await execSSH(conn, `certbot --nginx -d ${domain} --non-interactive --agree-tos --email brunn.hemann@gmail.com`);

  conn.end();
}

run().catch(console.error);
