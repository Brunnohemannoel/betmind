// scripts/deploy_vps.cjs
// Script para enviar o ZIP do agente IA para a VPS e atualizar o serviço
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const VPS_HOST = '191.252.100.73';
const VPS_USER = 'root';
const VPS_PASS = 'Brunn@80';
const VPS_PORT = 22;
const REMOTE_DIR = '/opt/betmind-ai';
const LOCAL_ZIP_PATH = path.join(__dirname, '..', 'betmind-ai-agent.zip');

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

async function run() {
  if (!fs.existsSync(LOCAL_ZIP_PATH)) {
    console.error(`\n❌ Erro: Arquivo ${LOCAL_ZIP_PATH} não encontrado.`);
    console.error(`Execute 'npm run build:system' primeiro.\n`);
    process.exit(1);
  }

  const conn = new Client();

  console.log(`\n🚀 Conectando à VPS ${VPS_HOST}...`);

  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: VPS_HOST, port: VPS_PORT, username: VPS_USER, password: VPS_PASS
    });
  });

  console.log('✅ SSH conectado!\n');

  // 1. Garantir que o diretório existe
  await execSSH(conn, `mkdir -p ${REMOTE_DIR}`);

  // 2. Upload do ZIP via SFTP
  console.log('📤 Enviando betmind-ai-agent.zip...');
  const sftp = await new Promise((res, rej) => conn.sftp((err, s) => err ? rej(err) : res(s)));
  const remoteZipPath = `${REMOTE_DIR}/betmind-ai-agent.zip`;
  await uploadFile(sftp, LOCAL_ZIP_PATH, remoteZipPath);
  console.log('✅ Upload concluído!');
  sftp.end();

  // 3. Extrair e Reiniciar
  console.log('\n📦 Extraindo arquivos na VPS...');
  // Nota: unzip -o sobrescreve arquivos existentes
  await execSSH(conn, `cd ${REMOTE_DIR} && unzip -o betmind-ai-agent.zip && rm betmind-ai-agent.zip`);

  console.log('\n🐍 Atualizando dependências (se necessário)...');
  await execSSH(conn, `cd ${REMOTE_DIR} && [ -f requirements.txt ] && ./venv/bin/pip install -r requirements.txt || echo "Sem requirements.txt"`);

  console.log('\n⚙️ Reiniciando serviço betmind-ai...');
  await execSSH(conn, 'systemctl restart betmind-ai');

  console.log('\n🔍 Verificando status...');
  await execSSH(conn, 'systemctl status betmind-ai --no-pager -l | grep Active');

  conn.end();
  console.log('\n\n✨ Atualização concluída com sucesso!');
}

run().catch(err => {
  console.error('\n❌ Erro no deploy:', err.message || err);
  process.exit(1);
});
