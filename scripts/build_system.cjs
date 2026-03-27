const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function run() {
  const rootDir = process.cwd();
  const distPath = path.join(rootDir, 'dist');
  const aiAgentPath = path.join(rootDir, 'ai-agent');
  const frontendZip = path.join(rootDir, 'betmind-frontend.zip');
  const backendZip = path.join(rootDir, 'betmind-ai-agent.zip');

  try {
    console.log("🚀 Starting System Build for Hosting...");

    // 1. Frontend Build
    console.log("\n📦 Building Frontend (Vite)...");
    execSync('npm run build', { stdio: 'inherit' });

    if (!fs.existsSync(distPath)) {
      throw new Error("Error: 'dist' directory not found after build.");
    }

    // 1.1 Create .htaccess for SPA routing in subfolder
    console.log("\n📄 Generating .htaccess for SPA routing...");
    const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /esportesorte/
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /esportesorte/index.html [L]
</IfModule>`;
    fs.writeFileSync(path.join(distPath, '.htaccess'), htaccessContent);
    console.log("✅ .htaccess created in dist/");

    // 2. Zip Frontend
    console.log("\n🤐 Zipping Frontend for Shared Hosting...");
    if (fs.existsSync(frontendZip)) fs.unlinkSync(frontendZip);
    
    // Using PowerShell for reliable zipping on Windows
    const zipFrontendCmd = `powershell -Command "Compress-Archive -Path '${distPath}\\*' -DestinationPath '${frontendZip}' -Force"`;
    execSync(zipFrontendCmd, { stdio: 'inherit' });
    console.log(`✅ Frontend Zipped: ${frontendZip}`);

    // 3. Zip AI Agent
    console.log("\n🐍 Preparing AI Agent for VPS...");
    if (fs.existsSync(backendZip)) fs.unlinkSync(backendZip);

    // We want to exclude venv, __pycache__, and potentially large data files
    // Since Compress-Archive doesn't easily support exclusions in a simple way, 
    // we'll create a temporary folder for the zip.
    const tempAiAgent = path.join(rootDir, 'temp-ai-agent');
    if (fs.existsSync(tempAiAgent)) {
        fs.rmSync(tempAiAgent, { recursive: true, force: true });
    }
    fs.mkdirSync(tempAiAgent);

    const filesToInclude = [
        'main.py', 'config.py', 'requirements.txt', '.env.example', 'README.md',
        'models', 'services', 'utils'
    ];

    console.log("📂 Copying necessary files for AI Agent...");
    filesToInclude.forEach(file => {
        const src = path.join(aiAgentPath, file);
        const dest = path.join(tempAiAgent, file);
        if (fs.existsSync(src)) {
            if (fs.lstatSync(src).isDirectory()) {
                // Simplified copy for directories (recursive)
                fs.cpSync(src, dest, { recursive: true, filter: (src) => !src.includes('__pycache__') });
            } else {
                fs.copyFileSync(src, dest);
            }
        }
    });

    console.log("🤐 Zipping AI Agent...");
    const zipBackendCmd = `powershell -Command "Compress-Archive -Path '${tempAiAgent}\\*' -DestinationPath '${backendZip}' -Force"`;
    execSync(zipBackendCmd, { stdio: 'inherit' });
    
    // Clean up temp folder
    fs.rmSync(tempAiAgent, { recursive: true, force: true });
    
    console.log(`✅ AI Agent Zipped: ${backendZip}`);

    console.log(`\n🎉 Build Completed Successfully!`);
    console.log(`-----------------------------------`);
    console.log(`📄 Frontend: ${frontendZip}`);
    console.log(`📄 AI Agent: ${backendZip}`);
    console.log(`-----------------------------------`);
    console.log(`\nNext steps:`);
    console.log(`1. Upload 'betmind-frontend.zip' to your public_html (shared hosting).`);
    console.log(`2. Upload 'betmind-ai-agent.zip' to your /opt/ folder (VPS).`);
    console.log(`3. Follow instructions in DEPLOY_GUIDE.md.`);

  } catch (error) {
    console.error("\n❌ Error during build process:");
    console.error(error.message);
    process.exit(1);
  }
}

run();
