# Guia de Hospedagem - BetMind AI

Este guia detalha como hospedar o sistema BetMind AI (Frontend e Agente IA).

## 1. Frontend (Hospedagem Compartilhada / HostGator / cPanel)

O frontend é uma aplicação estática (Vite/React).

1.  Gere o build rodando: `npm run build:system`
2.  Localize o arquivo `betmind-frontend.zip` na raiz do projeto.
3.  Acesse o **Gerenciador de Arquivos** do seu cPanel.
4.  Navegue até a pasta de destino (ex: `public_html/esportesorte/`).
5.  Faça o upload do `betmind-frontend.zip`.
6.  Extraia o conteúdo na pasta.
7.  Verifique se o arquivo `.htaccess` está presente para suportar rotas do React Router (veja abaixo).

### Configuração .htaccess (Obrigatório para Rotas)
Se as rotas não funcionarem (erro 404 ao atualizar a página), crie um arquivo `.htaccess` na mesma pasta do `index.html` com:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /esportesorte/
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /esportesorte/index.html [L]
</IfModule>
```

---

## 2. Agente IA (VPS / Ubuntu / Debian)

O Agente IA é uma API Python (FastAPI).

### Pré-requisitos na VPS
```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### Instalação
1.  Gere o build rodando: `npm run build:system`
2.  Envie o arquivo `betmind-ai-agent.zip` para a VPS (usando SCP ou FileZilla) para `/opt/betmind-ai/`.
3.  Extraia o arquivo:
    ```bash
    cd /opt/betmind-ai
    unzip betmind-ai-agent.zip
    ```
4.  Configure o ambiente:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    ```
5.  Configure o arquivo `.env` (use o `.env.example` como base).
6.  Inicie o serviço (exemplo com PM2 ou Systemd).

### Deploy Automatizado (Recomendado)
Para atualizar o backend de forma automática, use o comando:
```bash
npm run deploy:vps
```
Este comando irá:
1. Conectar via SSH à sua VPS.
2. Enviar o arquivo `betmind-ai-agent.zip`.
3. Extrair os arquivos na pasta `/opt/betmind-ai/`.
4. Instalar novas dependências (se houver).
5. Reiniciar o serviço `betmind-ai` automaticamente.

*Nota: Certifique-se de que as credenciais em `scripts/deploy_vps.cjs` estão corretas.*

### Exemplo Systemd (Recomendado)
Crie o arquivo `/etc/systemd/system/betmind-ai.service`:
```ini
[Unit]
Description=BetMind AI Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/betmind-ai
ExecStart=/opt/betmind-ai/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
EnvironmentFile=/opt/betmind-ai/.env

[Install]
WantedBy=multi-user.target
```
Habilite e inicie:
```bash
sudo systemctl daemon-reload
sudo systemctl enable betmind-ai
sudo systemctl start betmind-ai
```

---

## 3. Variáveis de Ambiente

Certifique-se de que os seguintes valores estão corretos:

### Frontend (.env)
- `VITE_SUPABASE_URL`: URL do seu projeto Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Chave anônima do Supabase.

### Agente IA (.env)
- `DATABASE_URL`: Conexão direta com o Postgres (Ex: `postgresql://user:pass@host:5432/db`).
- `REDIS_URL`: `redis://127.0.0.1:6379/0`
