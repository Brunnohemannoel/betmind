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

  const testScript = `
from config import engine, Base
from models.schema import Match, MatchesHistory, AiInsight, User, Post, Interaction
try:
    print("Testing DB connection and table creation...")
    Base.metadata.create_all(bind=engine)
    print("Success!")
except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()
`;

  await execSSH(conn, `echo '${testScript.replace(/'/g, "'\\''")}' > ${REMOTE_DIR}/db_test.py`);
  
  console.log('\n--- Running DB Test ---');
  const res = await execSSH(conn, `cd ${REMOTE_DIR} && ./venv/bin/python3 db_test.py`);
  console.log('STDOUT:', res.out);
  console.log('STDERR:', res.errOut);

  conn.end();
}

run().catch(console.error);
