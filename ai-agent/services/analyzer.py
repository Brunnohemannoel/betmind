class Analyzer:
    def __init__(self):
        pass

    def calcular_intensidade(self, features: dict) -> float:
        """
        intensidade = (shots_on_target * 3) + (corners * 2) + (dangerous_attacks * 2)
        """
        shots = features.get("shots_on_target", 0)
        corners = features.get("corners", 0)
        dangerous_attacks = features.get("dangerous_attacks", 0)
        
        intensidade = (shots * 3) + (corners * 2) + (dangerous_attacks * 2)
        # Normalizando entre 0 a 100 se necessário, aqui retornaremos o valor bruto como base de limite 100 max normal.
        return min(intensidade, 100.0)

    def calcular_probabilidade_gol(self, intensidade: float) -> float:
        """
        prob_gol = intensidade / 100
        """
        return min(intensidade / 100.0, 1.0)

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
        prob = self.calcular_probabilidade_gol(intensidade)
        is_value_bet = self.detectar_value_bet(prob, odd_mercado)
        
        suggestion = "Sem entrada clara"
        if prob > 0.75:
            suggestion = "Over 0.5 HT / Over 1.5 gols"
            
        return {
            "intensity": intensidade,
            "goal_probability": prob,
            "suggestion": suggestion,
            "is_value_bet": is_value_bet
        }
