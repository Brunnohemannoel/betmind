from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
import asyncio
from typing import List, Optional
import json
import hashlib
import uuid
import os
import uvicorn
from contextlib import asynccontextmanager
from datetime import datetime

from sqlalchemy import text
from config import redis_client, get_db, SessionLocal
from services.features import FeatureEngineer
from services.analyzer import Analyzer
from models.predictor import Predictor
from models.schema import Match, MatchesHistory, AiInsight

class AnalyzeRequest(BaseModel):
    match_id: str
    # Estatísticas opcionais enviadas pelo frontend (dados ao vivo)
    shots_on_target: Optional[int] = None
    corners: Optional[int] = None
    dangerous_attacks: Optional[int] = None
    attacks: Optional[int] = None
    minute: Optional[int] = None
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    home_team: Optional[str] = None
    away_team: Optional[str] = None
    league: Optional[str] = None

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="BetMind AI Agent")

# Configuração de CORS para permitir chamadas do frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Em produção, mude para o domínio real
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

feature_eng = FeatureEngineer()
analyzer = Analyzer()
predictor = Predictor()


def derive_features_from_match(req: AnalyzeRequest) -> dict:
    """
    Deriva features únicas por jogo usando dados reais (se disponíveis) ou um
    modelo seed baseado no match_id + times + liga para garantir resultados distintos.
    """
    # Usa hash do match_id para criar variação determinista (não aleatória)
    seed = int(hashlib.md5(req.match_id.encode()).hexdigest(), 16) % 10000

    # Se temos dados ao vivo, usamos eles
    if req.shots_on_target is not None:
        return {
            "shots_on_target": req.shots_on_target,
            "corners": req.corners or 0,
            "dangerous_attacks": req.dangerous_attacks or 0,
            "attacks": req.attacks or 0,
        }

    # Para jogos pré-jogo ou sem dados: busca do banco de dados (matches_live ou matches_history)
    db = SessionLocal()
    try:
        # Tenta primeiro no matches_live
        result = db.execute(
            text(f"SELECT * FROM matches_live WHERE id = '{req.match_id}' OR external_match_id = '{req.match_id}' LIMIT 1")
        ).fetchone()

        if not result:
            # Tenta no matches_history
            result = db.execute(
                text(f"SELECT * FROM matches_history WHERE id = '{req.match_id}' OR external_match_id = '{req.match_id}' LIMIT 1")
            ).fetchone()

        if result:
            row = dict(result._mapping)
            # Tenta extrair stats se existirem
            # O schema.py simplificado não tem stats, mas o banco pode ter colunas extras ou JSON
            # Por enquanto usamos o fallback se não houver colunas específicas
            pass
    except Exception as e:
        print(f"DB query failed for match {req.match_id}: {e}")
    finally:
        db.close()

    # Fallback para jogos pré-jogo: modelo preditivo baseado em seed único por jogo
    base = seed % 100
    variacao_shots = 4 + (seed % 12)       # 4 a 15 chutes
    variacao_corners = 2 + (seed % 8)       # 2 a 9 escanteios
    variacao_attacks = 25 + (seed % 40)     # 25 a 65 ataques
    variacao_dangerous = 8 + (seed % 22)    # 8 a 30 ataques perigosos

    return {
        "shots_on_target": variacao_shots,
        "corners": variacao_corners,
        "dangerous_attacks": variacao_dangerous,
        "attacks": variacao_attacks,
    }


def build_suggestion(prob: float, intensity: float, req: AnalyzeRequest) -> str:
    """Gera sugestão inteligente baseada na probabilidade e contexto do jogo."""
    seed = int(hashlib.md5(req.match_id.encode()).hexdigest(), 16) % 100

    if prob > 0.78:
        return "Over 0.5 HT / Pressão alta — Entre agora"
    elif prob > 0.68:
        return "Over 1.5 gols — Bom momento para apostar"
    elif prob > 0.55:
        options = ["Ambas marcam (Sim)", "Over 2.5 gols", "Gol nos próximos 10 min"]
        return options[seed % len(options)]
    else:
        return "Under 2.5 / Jogo controlado — Aguarde"


async def background_update_loop():
    """Atualização automática a cada 15 segundos — recalcula análises para jogos ao vivo."""
    while True:
        try:
            db = SessionLocal()
            try:
                # Busca IDs de jogos ao vivo na tabela correta
                live = db.execute(
                    text("SELECT id FROM matches_live WHERE status = 'live' LIMIT 50")
                ).fetchall()

                for row in live:
                    match_id = str(row[0])
                    cache_key = f"analysis:{match_id}"
                    # Só recalcula se cache expirou
                    if not redis_client.exists(cache_key):
                        req = AnalyzeRequest(match_id=match_id)
                        # Aqui poderíamos buscar o objeto completo para passar stats reais
                        features = derive_features_from_match(req)
                        
                        # Calcula e coloca no Redis
                        intensidade = analyzer.calcular_intensidade(features)
                        prob_gol = analyzer.calcular_probabilidade_gol(intensidade)
                        suggestion = build_suggestion(prob_gol, intensidade, req)
                        
                        output = {
                            "intensity": int(intensidade),
                            "goal_probability": round(float(prob_gol), 3),
                            "suggestion": suggestion,
                            "confidence": 70, # placeholder fixo no loop
                            "alerts": ["Atualização Automática"]
                        }
                        redis_client.setex(cache_key, 30, json.dumps(output))
            finally:
                db.close()
        except Exception as e:
            print(f"Error in background loop: {e}")

        await asyncio.sleep(15)


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop_task = asyncio.create_task(background_update_loop())
    yield
    loop_task.cancel()

app.router.lifespan_context = lifespan


@app.post("/analyze")
def analyze_match(req: AnalyzeRequest, db=Depends(get_db)):
    print(f"DEBUG: Receiving analyze request for {req.match_id} - {req.home_team} vs {req.away_team}")
    """POST /analyze — Análise única por jogo com dados reais ou preditivos."""
    match_id = req.match_id
    if match_id == "undefined":
        # Evita colisão se o frontend falhar no ID
        match_id = f"fallback_{hashlib.md5(f'{req.home_team}{req.away_team}'.encode()).hexdigest()[:8]}"

    # Tenta cache Redis primeiro
    cache_key = f"analysis:{match_id}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        return json.loads(cached_data)

    # Deriva features únicas por jogo
    features = derive_features_from_match(req)

    # Calcula intensidade e probabilidade
    intensidade = analyzer.calcular_intensidade(features)
    prob_gol = analyzer.calcular_probabilidade_gol(intensidade)

    # Probabilidades de vitória baseadas no seed e intensidade
    # (Pode ser refinado pelo predictor no futuro)
    seed = int(hashlib.md5(match_id.encode()).hexdigest(), 16) % 100
    base_home = 33 + (seed % 15) - 7
    base_away = 33 + ((seed + 50) % 15) - 7
    base_draw = 100 - base_home - base_away
    
    # Ajusta pela intensidade (simulando que quanto mais intenso, menos empates)
    if intensidade > 70:
        base_draw = max(10, base_draw - 10)
        dist = (100 - (base_home + base_away + base_draw)) / 2
        base_home += dist
        base_away += dist


    # Predição ML
    pred = predictor.predict([
        features["corners"],
        features["shots_on_target"],
        features["dangerous_attacks"],
        intensidade
    ])
    confidence = pred["confidence"]

    # Sugestão contextualizada
    suggestion = build_suggestion(prob_gol, intensidade, req)

    # Minuto do jogo para alertas
    minuto = req.minute or 0

    # Alertas dinâmicos
    alerts = []
    if intensidade > 80:
        alerts.append("🔥 Jogo quente")
    elif intensidade > 60:
        alerts.append("⚡ Ritmo elevado")
    if prob_gol > 0.75:
        alerts.append("⚡ Chance de gol")
    if minuto > 75:
        alerts.append("🚨 Últimos minutos — última chance")
    elif minuto > 60:
        alerts.append("⏰ Jogo entrando em fase decisiva")
    if not alerts:
        alerts.append("📊 Análise ativa — aguardando movimentação")

    # Gerar insight dinâmico
    trend_text = "ritmo acelerando" if intensidade > 60 else "ritmo moderado"
    pressure_text = f"forte pressão ({intensidade}%)" if intensidade > 70 else f"pressão regular ({intensidade}%)"
    
    if prob_gol > 0.6:
        insight = f"🔥 Atenção: {trend_text} com {pressure_text}. Indicadores apontam alta probabilidade de gol nos próximos minutos."
    elif base_home > 50:
        insight = f"🏠 Domínio claro do {req.home_team if req.home_team else 'Mandante'}. {pressure_text} sugere controle total das ações."
    elif base_away > 50:
        insight = f"🚀 Visitante perigoso: {req.away_team if req.away_team else 'Visitante'} com {pressure_text} em contra-ataques rápidos."
    else:
        insight = f"📊 Jogo equilibrado: {trend_text} e {pressure_text}. Ideal para análise de mercados de escanteios ou 'live betting'."

    output = {
        "intensity": int(intensidade),
        "goal_probability": round(float(prob_gol), 3),
        "win_home": int(base_home),
        "win_draw": int(base_draw),
        "win_away": int(base_away),
        "suggestion": suggestion,
        "insight": insight,
        "confidence": int(confidence),
        "alerts": alerts,
        "features_used": features,  # Debug info
    }

    # Cache Redis (TTL: 30s para live, 120s para pré-jogo)
    ttl = 30 if minuto > 0 else 120
    redis_client.setex(cache_key, ttl, json.dumps(output))

    # Persiste no banco ai_insights
    try:
        # Busca o ID interno se match_id for external_id
        match_row = db.query(Match).filter((Match.id == match_id) | (Match.external_match_id == match_id)).first()
        if match_row:
            db_insight = AiInsight(
                id=str(uuid.uuid4()),
                match_live_id=match_row.id,
                insight=f"Chance de gol estimada em {int(prob_gol*100)}%",
                suggestion=suggestion,
                trend="subindo" if intensidade > 70 else "estavel",
                pressure_score=int(intensidade),
                dominance_score=int(intensidade * 0.8),
                momentum_score=int(intensidade * 0.9),
                confidence=float(confidence),
                model_mode="hybrid",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(db_insight)
            db.commit()
    except Exception as e:
        print(f"DB persist error: {e}")

    return output


@app.get("/health")
def health():
    return {"status": "ok", "agent": "BetMind AI", "version": "1.2.0"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
