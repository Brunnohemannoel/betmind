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

  console.log('--- Scanning netstat ---');
  const netstat = await execSSH(conn, 'netstat -tulpn | grep -E "8000|8001"');
  console.log(netstat.out);

  console.log('\n--- Scanning PS for uvicorn ---');
  const ps = await execSSH(conn, 'ps aux | grep uvicorn | grep -v grep');
  console.log(ps.out);

  conn.end();
}

run().catch(console.error);
