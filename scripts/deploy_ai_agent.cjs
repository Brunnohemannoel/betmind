// deploy_ai_agent.cjs
// Faz o deploy completo do BetMind AI Agent para a VPS via SSH
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const VPS_HOST = '191.252.100.73';
const VPS_USER = 'root';
const VPS_PASS = 'Brunn@80';
const VPS_PORT = 22;
const REMOTE_DIR = '/opt/betmind-ai';
const LOCAL_DIR = path.join(__dirname, '..', 'ai-agent');

// Arquivos e sub-diretórios a copiar
const FILES_TO_UPLOAD = [
  { local: 'main.py', remote: 'main.py' },
  { local: 'config.py', remote: 'config.py' },
  { local: 'requirements.txt', remote: 'requirements.txt' },
  { local: 'models/schema.py', remote: 'models/schema.py' },
  { local: 'models/predictor.py', remote: 'models/predictor.py' },
  { local: 'services/data_loader.py', remote: 'services/data_loader.py' },
  { local: 'services/features.py', remote: 'services/features.py' },
  { local: 'services/analyzer.py', remote: 'services/analyzer.py' },
  { local: 'services/train.py', remote: 'services/train.py' },
];

const SYSTEMD_UNIT = `[Unit]
Description=BetMind AI Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${REMOTE_DIR}
ExecStart=${REMOTE_DIR}/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
EnvironmentFile=${REMOTE_DIR}/.env

[Install]
WantedBy=multi-user.target
`;

const REMOTE_ENV = `DATABASE_URL=postgresql://postgres:Brunn%4080@127.0.0.1:5432/betmind
REDIS_URL=redis://127.0.0.1:6379/0
`;

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

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, err => err ? reject(err) : resolve());
  });
}

function writeRemoteFile(sftp, remotePath, content) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(content, 'utf8');
    const stream = sftp.createWriteStream(remotePath);
    stream.on('error', reject);
    stream.on('close', resolve);
    stream.end(buf);
  });
}

async function run() {
  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: VPS_HOST, port: VPS_PORT, username: VPS_USER, password: VPS_PASS
    });
  });

  console.log('\n✅ SSH conectado!\n');

  // 1. Instalar Redis se não existir
  console.log('📦 Garantindo Redis instalado...');
  await execSSH(conn, 'apt-get install -y redis-server && systemctl enable redis-server && systemctl start redis-server');

  // 2. Criar diretórios
  console.log('\n📁 Criando estrutura de diretórios na VPS...');
  await execSSH(conn, `mkdir -p ${REMOTE_DIR}/models ${REMOTE_DIR}/services ${REMOTE_DIR}/data ${REMOTE_DIR}/utils`);

  // 3. Upload de arquivos via SFTP
  console.log('\n📤 Enviando arquivos do Agente IA...');
  const sftp = await new Promise((res, rej) => conn.sftp((err, s) => err ? rej(err) : res(s)));

  for (const f of FILES_TO_UPLOAD) {
    const localFull = path.join(LOCAL_DIR, f.local);
    const remoteFull = `${REMOTE_DIR}/${f.remote}`;
    if (fs.existsSync(localFull)) {
      await uploadFile(sftp, localFull, remoteFull);
      console.log(`  ✓ ${f.local} → ${remoteFull}`);
    }
  }

  // 4. Criar __init__.py para os pacotes
  await writeRemoteFile(sftp, `${REMOTE_DIR}/models/__init__.py`, '');
  await writeRemoteFile(sftp, `${REMOTE_DIR}/services/__init__.py`, '');
  await writeRemoteFile(sftp, `${REMOTE_DIR}/utils/__init__.py`, '');

  // 5. Criar .env remoto
  await writeRemoteFile(sftp, `${REMOTE_DIR}/.env`, REMOTE_ENV);
  console.log('\n✅ Arquivo .env criado na VPS');

  sftp.end();

  // 6. Criar venv e instalar dependências
  console.log('\n🐍 Configurando ambiente Python virtual...');
  await execSSH(conn, `cd ${REMOTE_DIR} && python3 -m venv venv && ./venv/bin/pip install --upgrade pip`);
  console.log('\n📦 Instalando dependências (pode demorar ~2 minutos)...');
  await execSSH(conn, `cd ${REMOTE_DIR} && ./venv/bin/pip install -r requirements.txt`);

  // 7. Treinar modelo inicial
  console.log('\n🧠 Treinando modelo inicial...');
  await execSSH(conn, `cd ${REMOTE_DIR} && ./venv/bin/python services/train.py`);

  // 8. Criar Systemd Unit
  console.log('\n⚙️  Configurando serviço Systemd...');
  const unitPath = '/etc/systemd/system/betmind-ai.service';
  await execSSH(conn, `cat > ${unitPath} << 'EOFUNIT'\n${SYSTEMD_UNIT}\nEOFUNIT`);
  await execSSH(conn, 'systemctl daemon-reload && systemctl enable betmind-ai && systemctl restart betmind-ai');

  // 9. Status
  console.log('\n🔍 Verificando status do serviço...');
  await execSSH(conn, 'systemctl status betmind-ai --no-pager -l');

  // 10. Verificar que a API responde
  console.log('\n🌐 Testando endpoint da API...');
  await execSSH(conn, "sleep 3 && curl -s -X POST http://127.0.0.1:8000/analyze -H 'Content-Type: application/json' -d '{\"match_id\":\"test-123\"}' | head -c 500");

  conn.end();
  console.log('\n\n🚀 Deploy concluído! Agente BetMind AI rodando em http://191.252.100.73:8000');
}

run().catch(err => {
  console.error('\n❌ Erro no deploy:', err.message || err);
  process.exit(1);
});
