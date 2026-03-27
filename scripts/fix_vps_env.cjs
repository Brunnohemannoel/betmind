const { Client } = require('ssh2');

const VPS_HOST = '191.252.100.73';
const VPS_USER = 'root';
const VPS_PASS = 'Brunn@80';
const VPS_PORT = 22;
const REMOTE_DIR = '/opt/betmind-ai';

function execSSH(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', d => { out += d; });
      stream.stderr.on('data', d => { console.error(d.toString()); });
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

  console.log('--- Updating .env on VPS ---');
  // Substitui a URL do banco para apontar para 'betmind' em vez de 'postgres'
  await execSSH(conn, `sed -i "s/@127.0.0.1:5432\\/postgres/@127.0.0.1:5432\\/betmind/g" ${REMOTE_DIR}/.env`);
  
  const env = await execSSH(conn, `cat ${REMOTE_DIR}/.env`);
  console.log('New .env:', env.out);

  conn.end();
}

run().catch(console.error);
