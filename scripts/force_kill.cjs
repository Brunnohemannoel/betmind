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

  console.log('--- Force Killing all matching processes ---');
  // Kill anything with 'uvicorn' or 'main:app'
  await execSSH(conn, "ps aux | grep -E 'uvicorn|main:app' | grep -v grep | awk '{print $2}' | xargs kill -9 || true");
  
  console.log('\n--- Checking port 8000 again ---');
  const res = await execSSH(conn, 'lsof -i :8000');
  console.log(res.out);

  conn.end();
}

run().catch(console.error);
