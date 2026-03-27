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
      let errOut = '';
      stream.on('data', d => { out += d; });
      stream.stderr.on('data', d => { errOut += d; });
      stream.on('close', code => resolve({ code, out, errOut }));
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

  console.log('\n--- Manual Startup on Port 8001 ---');
  // Use timeout to prevent hanging
  const manual = await execSSH(conn, `cd ${REMOTE_DIR} && timeout 10s ./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001`);
  console.log('STDOUT:', manual.out);
  console.log('STDERR:', manual.errOut);

  conn.end();
}

run().catch(console.error);
