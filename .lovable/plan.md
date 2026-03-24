
Objetivo aprovado
Refatorar a exibição de jogos ao vivo para transmitir “tempo real + urgência” em 3 pontos: cards, modal ANÁLISE IA e alertas flutuantes, com formato completo (minuto/período + cronômetro + barra) e adaptação para todos os esportes (futebol, basquete, tênis, esports).

Plano de implementação

1) Expandir o contrato de tempo no backend (fonte única)
- Atualizar `supabase/functions/betsapi-live/index.ts` para enviar um bloco `timeContext` por jogo:
  - `sport`, `minute`, `phaseLabel`, `phaseKey`, `elapsedSeconds`, `remainingSeconds`, `progressPct`, `isCriticalWindow`, `urgencyLevel`.
- Criar parser por esporte:
  - Futebol: 1º tempo / intervalo / 2º tempo / acréscimos.
  - Basquete: Q1–Q4 + tempo restante do quarto.
  - Tênis: set atual + games/pontos (quando disponível).
  - Esports: mapa/round + tempo de partida.
- Gerar alertas baseados em tempo no backend (não só pressão): `final_minutes`, `critical_moment`, `value_before_end`.

2) Cronômetro em tempo real no frontend (1s)
- Em `src/pages/Index.tsx`, criar estado local de “agora” com tick a cada 1s.
- Calcular display em tempo real a partir de `timeContext` + `lastUpdate`, sem esperar polling de 30s.
- Garantir fallback seguro quando a API não trouxer campos completos (mostrar status atual sem quebrar UI).

3) Novo cabeçalho temporal nos cards centrais
- Substituir o status textual simples por bloco visual:
  - Linha 1: ícone do esporte + minuto/período (ex.: “⚽ 67' — 2º Tempo”).
  - Linha 2: contador (ex.: “⏳ 14:32 para o fim” quando aplicável).
  - Linha 3: barra de progresso da partida com percentual.
- Aplicar cores de urgência:
  - verde (normal), amarelo (atenção), vermelho (urgente).

4) Reforçar urgência nos alertas flutuantes
- Incluir tempo/período dentro do card de notificação.
- Exibir mensagem contextual por regra:
  - “⏱️ Últimos minutos! Odds podem mudar rápido”
  - “⚡ Momento crítico — aproveite agora”
  - “🚨 FINAL DE JOGO! Última chance de apostar”
- Manter comportamento atual: clique abre jogo + modal e auto-close em até 8s.

5) Modal ANÁLISE IA com bloco “Tempo & Urgência”
- Em `src/pages/Index.tsx`, adicionar bloco dedicado no modal com:
  - período atual,
  - cronômetro vivo,
  - barra de progresso,
  - badge de urgência,
  - insight curto combinando tempo + pressão + chance de evento.
- Priorizar visualmente este bloco quando `urgencyLevel` for alto.

6) Página “Alertas IA” com persistência até fim da partida
- Aproveitar `alertStore` atual e incluir categoria “alertas de tempo”.
- Alertas continuam visíveis na página de alertas enquanto o jogo estiver `live/upcoming`; removem ao finalizar/desaparecer do feed.
- Ordenar por prioridade: urgente > oportunidade > médio > risco.

7) Refino visual e animações
- Em `src/index.css`, criar classes para:
  - “time-pill”, “urgency-pill”, “match-progress-bar”, “critical-pulse”.
- Usar animações já existentes (fade/scale/slide) + pulso sutil apenas no crítico.
- Garantir legibilidade no viewport atual (1586x853) e responsividade mobile.

Regras de negócio (resumo)
- Futebol:
  - 0–45: 1º Tempo
  - 45–60: Intervalo
  - 60–90: 2º Tempo
  - 90+: Acréscimos
- Urgência:
  - Atenção: minuto >= 70
  - Urgente: minuto >= 80 + pressão/probabilidade altas
  - Countdown: habilitar quando fim próximo + sinal de evento favorável.

Arquivos-alvo
- `supabase/functions/betsapi-live/index.ts` (timeContext + alertas temporais por esporte)
- `src/pages/Index.tsx` (tick 1s, render de tempo em cards/modal/alertas, regras de urgência)
- `src/index.css` (estilos e animações de tempo/progresso/urgência)

Critérios de aceite
- O usuário vê imediatamente tempo/período em cards, modal e alertas.
- Cronômetro atualiza a cada 1 segundo no frontend.
- Barra de progresso e cor de urgência mudam dinamicamente.
- Alertas de tempo aparecem, são clicáveis, somem em até 8s e ficam registrados em “Alertas IA” até o fim da partida.
- Funciona para futebol, basquete, tênis e esports com fallback quando dados específicos não vierem.
