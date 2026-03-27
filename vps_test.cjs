
const { Client } = require('ssh2');

const conn = new Client();
async function runCmd(cmd) {
  return new Promise((resolve, reject) => {
    let output = '';
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (data) => output += data.toString());
      stream.stderr.on('data', (data) => output += data.toString());
      stream.on('close', () => resolve(output));
    });
  });
}

conn.on('ready', async () => {
  try {
    console.log('--- LOGS ---');
    console.log(await runCmd('journalctl -u betmind-ai -n 50 --no-pager'));
    
    console.log('--- NGINX LIST ---');
    console.log(await runCmd('ls -la /etc/nginx/sites-enabled/'));
    
    console.log('--- NGINX DEFAULT ---');
    console.log(await runCmd('cat /etc/nginx/sites-enabled/default'));

    console.log('--- APP DIR ---');
    console.log(await runCmd('ls -la /opt/betmind-ai/'));
    
    console.log('--- CHECK SSL ---');
    console.log(await runCmd('ls -la /etc/letsencrypt/live/'));
  } catch (e) {
    console.error(e);
  } finally {
    conn.end();
  }
}).connect({
  host: '191.252.100.73', port: 22, username: 'root', password: 'Brunn@80'
});
