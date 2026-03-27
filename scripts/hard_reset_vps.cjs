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

  console.log('1. Stopping and disabling service...');
  await execSSH(conn, 'systemctl stop betmind-ai');
  await execSSH(conn, 'systemctl disable betmind-ai');

  console.log('2. Hard killing processes on 8000...');
  await execSSH(conn, 'fuser -k 8000/tcp || true');
  await execSSH(conn, "ps aux | grep -E 'main:app|uvicorn' | grep -v grep | awk '{print $2}' | xargs kill -9 || true");
  
  console.log('3. Waiting for cleanup...');
  await new Promise(res => setTimeout(res, 3000));

  console.log('4. Verifying port 8000 is clear...');
  const verify = await execSSH(conn, 'lsof -i :8000');
  console.log('LSOF output:', verify.out);

  if (verify.out.trim() === '') {
    console.log('5. Restarting service...');
    await execSSH(conn, 'systemctl enable betmind-ai');
    await execSSH(conn, 'systemctl start betmind-ai');
    
    await new Promise(res => setTimeout(res, 5000));
    const status = await execSSH(conn, 'systemctl status betmind-ai --no-pager -l');
    console.log(status.out);
  } else {
    console.error('❌ PORT 8000 STILL IN USE! Manually killing processes again.');
  }

  conn.end();
}

run().catch(console.error);
