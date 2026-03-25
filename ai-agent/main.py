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
from models.schema import Match, MatchesHistory, AiInsight, User, Post, Interaction
from config import engine, Base

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

# Cria tabelas se não existirem
Base.metadata.create_all(bind=engine)

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

    # Cálculos de chances de eventos
    goal_chance = int(prob_gol * 100)
    # Heurística para escanteios/cartões baseada na intensidade e minuto
    minuto = req.minute or 0
    corner_chance = min(95, int(45 + (intensidade * 0.4) + (minuto / 10)))
    card_chance = min(90, int(20 + (intensidade * 0.3) + (minuto / 5)))

    # Melhor Aposta e Justificativa
    if prob_gol > 0.7:
        bb_market = "Over 1.5 gols"
        bb_rationale = f"Ritmo altíssimo e {pressure_text}. O gol é iminente."
    elif base_home > 55:
        bb_market = f"Vencedor: {req.home_team if req.home_team else 'Casa'}"
        bb_rationale = f"Dominância estatística clara do mandante com {pressure_text}."
    elif base_away > 55:
        bb_market = f"Vencedor: {req.away_team if req.away_team else 'Visitante'}"
        bb_rationale = f"Visitante aproveitando melhor as brechas com {pressure_text}."
    elif corner_chance > 80:
        bb_market = "Over 9.5 Escanteios"
        bb_rationale = f"Volume de ataques pelas laterais indica alta frequência de cantos."
    else:
        bb_market = "Under 3.5 gols"
        bb_rationale = "Jogo equilibrado e defesas bem postadas no momento."

    risk_level = "low" if confidence > 75 else "medium" if confidence > 45 else "high"

    # Gera timelines simuladas para gráficos baseadas na intensidade atual
    # No futuro, isso buscará dados históricos reais do banco
    pressure_timeline = []
    event_timeline = []
    prob_timeline = []
    
    for i in range(1, 8):
        # Gera flutuação ao redor da intensidade atual
        step_min = (i * 15) - 10
        p_val = max(0, min(100, intensidade + (i * 2) - 10))
        pressure_timeline.append({"label": f"{step_min}'", "home": p_val, "away": 100 - p_val})
        
        # Eventos (Gols, Cantos, Cartões)
        e_val = int(prob_gol * 100 * (i/10))
        event_timeline.append({
            "label": f"{step_min}'", 
            "goals": int(e_val * 0.3), 
            "corners": int(e_val * 0.7), 
            "cards": int(e_val * 0.2)
        })
        
        # Probabilidades Win/Draw/Loss
        prob_timeline.append({
            "label": f"{step_min}'", 
            "home": base_home - (10-i), 
            "draw": base_draw, 
            "away": base_away + (10-i)
        })

    output = {
        "intensity": int(intensidade),
        "goal_probability": round(float(prob_gol), 3),
        "win_home": int(base_home),
        "win_draw": int(base_draw),
        "win_away": int(base_away),
        "goal_chance": goal_chance,
        "corner_chance": corner_chance,
        "card_chance": card_chance,
        "best_bet": {
            "market": bb_market,
            "confidence": int(confidence),
            "rationale": bb_rationale
        },
        "risk_level": risk_level,
        "charts": {
            "pressureTimeline": pressure_timeline,
            "eventTimeline": event_timeline,
            "probabilityTimeline": prob_timeline
        },
        "suggestion": suggestion,
        "insight": insight,
        "confidence": int(confidence),
        "alerts": alerts,
        "features_used": features,
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

# --- ENDPOINTS COMUNIDADE ---

class PostCreate(BaseModel):
    user_id: str
    content: str
    match_id: Optional[str] = None
    bet_data: Optional[dict] = None

class InteractionCreate(BaseModel):
    post_id: str
    user_id: str
    type: str # like, comment, repost
    content: Optional[str] = None

COMMUNITY_MOCK_FEED = [
    {
        "id": "ai-post-1",
        "user": {"username": "BetMind_IA", "reputation": 9999, "badges": ["🤖 IA OFICIAL"]},
        "content": "🤖 PSG dominando as ações. Pressão ofensiva altíssima nos últimos 10 minutos. O gol está maduro.",
        "ai_validated": True,
        "ai_score": 0.97,
        "ai_recommendation": "ENTRAR AGORA",
        "bet_data": {"market": "Over 0.5 HT (Gols no 1º Tempo)", "odd": 1.85},
        "match_info": {
            "match_id": "8421034",
            "home_team": "PSG",
            "away_team": "Arsenal",
            "home_score": 0,
            "away_score": 0,
            "minute": 34,
            "league": "Champions League"
        },
        "urgency": {
            "time_left": "11:00",
            "intensity": 92,
            "label": "JOGO EXPLODINDO 🔥"
        },
        "social_proof": {
            "bettors_count": 124,
            "community_percentage": 87,
            "trending": True
        },
        "created_at": datetime.now().isoformat(),
        "likes": 215,
        "comments": 54,
    },
    {
        "id": "ai-post-2",
        "user": {"username": "GreenHunter_23", "reputation": 342, "badges": ["PRO", "🔥 Streak 7"]},
        "content": "🔥 Bayern massacrando no volume. 87% de posse no terço final. Aposta de valor no mercado de gols.",
        "ai_validated": True,
        "ai_score": 0.94,
        "ai_recommendation": "ENTRAR AGORA",
        "bet_data": {"market": "Over 1.5 Gols", "odd": 1.62},
        "match_info": {
            "match_id": "9120394",
            "home_team": "Bayern",
            "away_team": "Dortmund",
            "home_score": 1,
            "away_score": 0,
            "minute": 62,
            "league": "Bundesliga"
        },
        "urgency": {
            "time_left": "28:00",
            "intensity": 87,
            "label": "MISSÃO GREEN ✅"
        },
        "social_proof": {
            "bettors_count": 85,
            "community_percentage": 74
        },
        "created_at": datetime.now().isoformat(),
        "likes": 48,
        "comments": 12,
    },
    {
        "id": "ai-post-3",
        "user": {"username": "Estrategista_VIP", "reputation": 890, "badges": ["ELITE", "⭐ Top 10"]},
        "content": "📊 Madrid controlando o ritmo. Jogo muito truncado no meio campo. Valor no Under.",
        "ai_validated": True,
        "ai_score": 0.88,
        "ai_recommendation": "AGUARDAR",
        "bet_data": {"market": "Under 2.5 Gols", "odd": 1.95},
        "match_info": {
            "match_id": "7623091",
            "home_team": "Real Madrid",
            "away_team": "Atlético",
            "home_score": 0,
            "away_score": 0,
            "minute": 20,
            "league": "La Liga"
        },
        "urgency": {
            "intensity": 45,
            "label": "RITMO MODERADO 📊"
        },
        "social_proof": {
            "bettors_count": 42,
            "community_percentage": 61
        },
        "created_at": datetime.now().isoformat(),
        "likes": 103,
        "comments": 31,
        "comments_list": []
    },
]

@app.get("/community/feed")
def get_feed(db = Depends(get_db)):
    try:
        db_posts = db.query(Post).order_by(Post.created_at.desc()).limit(50).all()
        result = []
        
        # Combine real posts and mocks to fetch interactions for all
        all_posts_data = []
        for p in db_posts:
            all_posts_data.append({
                "id": p.id,
                "user": {"username": p.user_id, "reputation": 100, "badges": ["PRO"]},
                "content": p.content,
                "ai_validated": p.ai_validated,
                "ai_score": p.ai_score,
                "bet_data": p.bet_data,
                "match_info": {"match_id": p.match_id, "home_team": "Jogo", "away_team": "Referente", "league": "Liga"} if p.match_id else None,
                "created_at": p.created_at.isoformat() if p.created_at else datetime.now().isoformat(),
            })
        
        # Add mocks to the list of IDs to check interactions for (use copy to avoid mutation)
        for m in COMMUNITY_MOCK_FEED:
            all_posts_data.append(m.copy())
        
        final_result = []
        for post_data in all_posts_data:
            pid = post_data["id"]
            inters = db.query(Interaction).filter(Interaction.post_id == pid).order_by(Interaction.created_at.asc()).all()
            
            # Use original counts from mock if they exist, but add DB interactions on top
            db_likes = len([i for i in inters if i.type == 'like'])
            db_comments = [{"username": i.user_id, "content": i.content} for i in inters if i.type == 'comment']
            
            orig_likes = post_data.get("likes")
            if not isinstance(orig_likes, int): orig_likes = 0
            post_data["likes"] = orig_likes + db_likes
            
            orig_comments_count = post_data.get("comments")
            if not isinstance(orig_comments_count, int): orig_comments_count = 0
            post_data["comments"] = orig_comments_count + len(db_comments)
            
            # Initialize or extend comments_list
            if "comments_list" not in post_data or post_data["comments_list"] is None:
                post_data["comments_list"] = []
            
            # Add DB comments
            post_data["comments_list"].extend(db_comments)
            
            final_result.append(post_data)
            
        return final_result
    except Exception as e:
        print(f"Community feed DB error (using mock): {e}")
    return COMMUNITY_MOCK_FEED

@app.post("/community/post")
def create_post(req: PostCreate, db = Depends(get_db)):
    # Validação automática IA (Mock)
    is_valid = len(req.content) > 10
    score = 0.85 if "pressão" in req.content.lower() else 0.5
    
    new_post = Post(
        id=str(uuid.uuid4()),
        user_id=req.user_id,
        content=req.content,
        match_id=req.match_id,
        bet_data=req.bet_data,
        ai_validated=is_valid,
        ai_score=score,
        created_at=datetime.now()
    )
    db.add(new_post)
    db.commit()
    return {"status": "success", "post_id": new_post.id}

@app.post("/community/interact")
def interact(req: InteractionCreate, db = Depends(get_db)):
    new_inter = Interaction(
        id=str(uuid.uuid4()),
        post_id=req.post_id,
        user_id=req.user_id,
        type=req.type,
        content=req.content,
        created_at=datetime.now()
    )
    db.add(new_inter)
    db.commit()
    return {"status": "success"}

# ----------------------------


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
