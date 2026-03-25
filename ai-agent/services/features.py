from models.schema import Match

class FeatureEngineer:
    def __init__(self):
        pass

    def extract_features(self, match: Match):
        """Gerar métricas como:
        média de gols, escanteios, chutes no gol, forma recente, intensidade, momentum.
        """
        # Exemplo simulando estatísticas já extraídas pelo banco
        stats = getattr(match, 'stats', {}) or {}
        
        corners = stats.get("corners", 0)
        shots_on_target = stats.get("shots_on_target", 0)
        dangerous_attacks = stats.get("dangerous_attacks", 0)
        attacks = stats.get("attacks", 0)
        
        # Exemplo de momentum recente (simulado)
        momentum = attacks * 0.5 + dangerous_attacks * 1.5

        return {
            "corners": corners,
            "shots_on_target": shots_on_target,
            "dangerous_attacks": dangerous_attacks,
            "attacks": attacks,
            "momentum": momentum,
            "avg_goals_historic": 2.5 # placeholder de forma recente
        }
