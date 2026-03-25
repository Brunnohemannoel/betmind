import json
from models.schema import Match, MatchesHistory, Event, Team
from config import SessionLocal
from sqlalchemy import func

class DataLoader:
    def __init__(self):
        self.db = SessionLocal()

    def get_training_data(self):
        """
        Busca dados históricos de partidas e consolida estatísticas dos eventos para treinamento.
        Retorna (X, y) para o modelo.
        X = [corners, shots, dangerous_attacks, intensity]
        y = [1 se home_score > away_score else 0] (Exemplo simples de predição de vitória)
        """
        matches = self.db.query(MatchesHistory).all()
        X = []
        y = []

        print(f"Processando {len(matches)} partidas para treinamento...")

        for m in matches:
            # Consolida eventos da partida
            events = self.db.query(Event).filter(Event.match_id == m.id).all()
            
            corners = len([e for e in events if "Corner" in e.type])
            shots = len([e for e in events if "Shot" in e.type or "Goal" in e.type])
            dangerous = len([e for e in events if "Pressure" in e.type or "Dangerous" in e.type])
            
            # Intensidade simulada baseada nos eventos
            # (Num cenário real, isso seria calculado minuto a minuto)
            intensity = (corners * 2 + shots * 3 + dangerous * 1.5) / 10
            intensity = min(100.0, intensity * 10) # Normaliza para 0-100

            X.append([corners, shots, dangerous, intensity])
            
            # Target: Vitória do time da casa
            win = 1 if (m.home_score or 0) > (m.away_score or 0) else 0
            y.append(win)

        return X, y

    def get_live_games(self):
        """Carregar jogos ao vivo a partir do Banco de Dados"""
        return self.db.query(Match).filter(Match.status == "live").all()

    def save_to_db(self, instance):
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)
        return instance

    def close(self):
        self.db.close()
