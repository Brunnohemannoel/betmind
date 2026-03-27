const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  // Update the systemd service to use production uvicorn (no --reload)
  const serviceContent = `[Unit]
Description=BetMind AI Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/betmind-ai
ExecStart=/opt/betmind-ai/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
Restart=always
RestartSec=10
EnvironmentFile=/opt/betmind-ai/.env

[Install]
WantedBy=multi-user.target
`;

  const escapedContent = serviceContent.replace(/'/g, "'\\''");
  const cmd = `echo '${escapedContent}' > /etc/systemd/system/betmind-ai.service && systemctl daemon-reload && pkill -9 -f uvicorn; sleep 3 && systemctl start betmind-ai && sleep 4 && curl -s http://127.0.0.1:8000/health`;

  conn.exec(cmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '191.252.100.73', port: 22, username: 'root', password: 'Brunn@80' });
