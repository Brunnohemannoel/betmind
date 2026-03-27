from typing import Optional

class Analyzer:
    def __init__(self):
        pass

    def calcular_intensidade(self, features: dict) -> float:
        """
        Calcula a intensidade baseada em ataques perigosos, escanteios e chutes.
        Pesos:
        - Chutes no alvo: 3.5
        - Escanteios: 2.0
        - Ataques Perigosos: 1.5
        - Ataques Totais: 0.1
        """
        shots = features.get("shots_on_target", 0)
        corners = features.get("corners", 0)
        dangerous_attacks = features.get("dangerous_attacks", 0)
        attacks = features.get("attacks", 0)
        
        # Fórmula refinada baseada na lógica da Edge Function
        intensidade = (shots * 3.5) + (corners * 2.0) + (dangerous_attacks * 1.5) + (attacks * 0.1)
        
        # Normalização com teto de 100
        return min(intensidade, 100.0)

    def calcular_probabilidade_gol(self, intensidade: float, features: Optional[dict] = None) -> float:
        """
        Probabilidade baseada na intensidade com bônus por atividade recente.
        """
        prob_base = intensidade / 100.0
        
        # Bônus se tiver muita atividade (simulado)
        if features and features.get("dangerous_attacks", 0) > 15:
            prob_base += 0.1
            
        return min(prob_base, 0.98)

    def build_suggestion(self, prob: float, intensidade: float, features: dict) -> str:
        """Gera sugestão contextualizada baseada nos scouts reais."""
        da = features.get("dangerous_attacks", 0)
        corners = features.get("corners", 0)
        shots = features.get("shots_on_target", 0)

        if prob > 0.85:
            return "🔥 Pressão extrema: Entrada imediata em Over 0.5 HT ou Próximo Gol."
        elif intensidade > 75 and corners > 6:
            return "🚩 Volume lateral alto: Excelente oportunidade para mercado de Escanteios."
        elif prob > 0.70:
            return "⚽ Jogo muito aberto: Ambas Marcam (BTTS) ou Over 1.5 gols tem alto valor."
        elif shots > 5 and intensidade > 60:
            return "🎯 Pontaria em dia: Procure entradas em 'Mais de 1.5 chutes ao gol' do favorito."
        elif intensidade < 40:
            return "🛡️ Jogo truncado: Tendência de Under 2.5 gols ou empate técnico."
        else:
            return "📊 Monitorando: Aguarde o 'pico de pressão' para uma entrada mais segura."

    def detectar_value_bet(self, prob_calculada: float, odd_mercado: float) -> bool:
        """
        Detecta Value Bet quando a probabilidade implícita do mercado é menor
        que a probabilidade real que a IA calculou.
        """
        if odd_mercado <= 1.0:
            return False
            
        prob_implicita = 1 / odd_mercado
        # Se nossa prob for no mínimo 10% maior que do mercado, tem valor
        return prob_calculada > (prob_implicita * 1.10)
        
    def analisar_jogo(self, features: dict, odd_mercado: float = 2.0):
        intensidade = self.calcular_intensidade(features)
        prob = self.calcular_probabilidade_gol(intensidade, features)
        is_value_bet = self.detectar_value_bet(prob, odd_mercado)
        
        suggestion = self.build_suggestion(prob, intensidade, features)
            
        return {
            "intensity": intensidade,
            "goal_probability": prob,
            "suggestion": suggestion,
            "is_value_bet": is_value_bet
        }
