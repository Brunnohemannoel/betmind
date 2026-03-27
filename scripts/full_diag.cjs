const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  // Test direct on port 8000 internal, check routes, check service status
  const cmd = `
ss -tlnp | grep 8000;
echo "---STATUS---";
systemctl is-active betmind-ai;
echo "---INTERNAL TEST---";
curl -s -X POST http://127.0.0.1:8000/analyze -H "Content-Type: application/json" -d '{"match_id":"test"}' | head -c 200;
echo "";
echo "---HEALTH---";
curl -s http://127.0.0.1:8000/health;
echo "";
echo "---ROUTES---";
curl -s http://127.0.0.1:8000/openapi.json | python3 -c "import sys,json; d=json.load(sys.stdin); [print(k) for k in d.get('paths',{}).keys()]" 2>/dev/null
  `;
  conn.exec(cmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '191.252.100.73', port: 22, username: 'root', password: 'Brunn@80' });
