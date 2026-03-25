# 🧠 BetMind AI - A Inteligência por trás da sua Aposta

O **BetMind AI** é uma plataforma avançada de análise e gestão de apostas esportivas que combina algoritmos de inteligência artificial com uma experiência de usuário (UX) de alto nível. Desenvolvido para traders e apostadores que buscam precisão, o sistema oferece insights em tempo real para maximizar as chances de lucro.

---

## 🚀 Funcionalidades Principais

### 🧠 Inteligência Artificial Preditiva
- **Análise em Tempo Real**: Algoritmo que processa dados de jogos ao vivo para sugerir o melhor momento de entrada.
- **Sugestora de Múltiplas**: Seções dedicadas para montagem automática de bilhetes:
  - 🟢 **Múltipla Segura**: Foco em consistência com odds conservadoras.
  - ⚡ **Múltipla Moderada**: Equilíbrio ideal entre risco e retorno.
  - 🚀 **Múltipla Agressiva**: Para retornos explosivos baseados em tendências de zebra ou viradas.
- **Avaliação de Risco**: Todo bilhete de aposta é analisado pela IA, que classifica o risco entre Baixo, Médio e Alto.

### 🤖 O Agente BetMind AI
O coração da plataforma é um Agente Autônomo projetado para operar como um analista profissional:
- **Monitoramento 24/7**: O agente varre milhares de eventos simultaneamente, identificando oportunidades que passam despercebidas pelo olho humano.
- **Detecção de Padrões**: Analisa o histórico de confrontos, forma atual e pressão de jogo (Live Pressure) para prever o próximo evento (Gol, Escanteio ou Cartão).
- **Modo de Aprendizado**: 
  - **Base de Dados Histórica**: O agente utiliza uma vasta base de dados para comparar cenários atuais com situações passadas.
  - **Ajuste de Confiança**: À medida que o jogo avança, o agente recalcula suas predições, aumentando o nível de confiança conforme a pressão estatística se consolida.
  - **Refinamento Contínuo**: O sistema aprende com os resultados reais ("Green" ou "Red"), ajustando os pesos de suas variáveis para predições futuras cada vez mais precisas.

### ⚽ Experiência de Aposta "Zero Fricção"
- **Seleção Direta**: Aposte diretamente na lista de jogos com um clique nas odds (1X2).
- **Bet Slip Inteligente**: Painel lateral (Desktop) ou gaveta (Mobile) que calcula automaticamente odds totais e retorno potencial.
- **Micro-interações**: Feedback tátil (vibração) e animações suaves para uma experiência premium e profissional.

### 💳 Gestão de Banca e Depósito
- **Depósito Instantâneo via Pix**: Fluxo simulado completo com geração de QR Code e atualização de saldo em tempo real.
- **Minhas Apostas**: Histórico persistente de todas as apostas realizadas, com abas para bilhetes "Em Andamento" e "Resolvidas".
- **Simulador de Resultados**: Teste sua estratégia com botões de simulação de "Green" ou "Red" que atualizam sua banca instantaneamente.

### 💎 Design Premium
- **Interface Moderna**: Estética baseada em *Glassmorphism* e *Dark Mode*.
- **Navegação Otimizada**: Cabeçalho de categorias e busca fixo (sticky) para agilidade na seleção de partidas.
- **Gráficos Avançados**: Visualização de desempenho e estatísticas via Recharts.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/)
- **Estilização**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) + [Shadcn UI](https://ui.shadcn.com/)
- **Backend/Database**: [Supabase](https://supabase.com/)
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Animações**: [Tailwind CSS Animate](https://github.com/jamiebuilds/tailwindcss-animate)

---

## 📦 Como Iniciar o Projeto

1. **Clonar o repositório**:
   ```bash
   git clone https://github.com/Brunnohemannoel/betmind.git
   ```

2. **Instalar dependências**:
   ```bash
   npm install
   ```

3. **Configurar variáveis de ambiente**:
   Crie um arquivo `.env` baseado no `.env.example` com suas credenciais do Supabase.

4. **Executar em modo desenvolvimento**:
   ```bash
   npm run dev
   ```

---

## 🚢 Build e Implantação (Hospedagem)

Para gerar uma versão de produção otimizada para hospedagem em subdiretórios (ex: `/esportesorte/`):

1.  **Executar o script de automação**:
    ```bash
    node scripts/build_and_zip.cjs
    ```
    Este script irá:
    - Compilar o projeto usando `vite build` com o caminho base correto.
    - Ajustar as rotas para o diretório de destino.
    - Gerar o arquivo `betmind-dist.zip` na raiz do projeto.

2.  **Enviar para o Servidor**:
    - Faça o upload do arquivo `betmind-dist.zip`.
    - Extraia o conteúdo diretamente na pasta de destino (ex: `/public_html/esportesorte/`).
    - O arquivo `.htaccess` incluso já está configurado para suportar o roteamento SPA (Single Page Application) na subpasta.

---

## 📄 Licença

Este projeto é para uso educacional e demonstração de capacidades técnicas em desenvolvimento web e integração de IA.

---
**BetMind AI** - *Transformando dados em lucro.* 🎲📈
