const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function run() {
  try {
    console.log("🚀 Iniciando build de produção...");
    // Rodar o build do Vite
    execSync('npm run build', { stdio: 'inherit' });

    console.log("\n📦 Compactando o diretório dist...");
    const distPath = path.join(process.cwd(), 'dist');
    const zipPath = path.join(process.cwd(), 'betmind-dist.zip');

    // Verificar se o diretório dist existe
    if (!fs.existsSync(distPath)) {
      throw new Error("Erro: Diretório 'dist' não encontrado após o build.");
    }

    // Remover zip antigo se existir
    if (fs.existsSync(zipPath)) {
      console.log("🗑️ Removendo arquivo zip antigo...");
      fs.unlinkSync(zipPath);
    }

    // Usar PowerShell para compactar (nativo no Windows)
    console.log("🤐 Gerando arquivo ZIP...");
    const psCommand = `powershell -Command "Compress-Archive -Path '${distPath}\\*' -DestinationPath '${zipPath}' -Force"`;
    execSync(psCommand, { stdio: 'inherit' });

    console.log(`\n✅ Sucesso!`);
    console.log(`📁 Local do Build: ${distPath}`);
    console.log(`📦 Arquivo ZIP: ${zipPath}`);
    console.log(`🔗 URL de Destino: https://torrenettelecom.com.br/esportesorte/`);
    console.log(`\nAgora você pode pegar o arquivo 'betmind-dist.zip' e extrair na sua hospedagem.`);
  } catch (error) {
    console.error("\n❌ Erro durante o processo:");
    console.error(error.message);
    process.exit(1);
  }
}

run();
