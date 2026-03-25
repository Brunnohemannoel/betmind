import os
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

MODEL_PATH = os.path.join(os.path.dirname(__file__), "trained_model.joblib")

class Predictor:
    def __init__(self):
        self.model = None
        self._load_model()

    def _load_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
            except:
                self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        else:
            self.model = RandomForestClassifier(n_estimators=100, random_state=42)
            
    def predict(self, features: list):
        """
        Prevê baseado num array de features ordenadas.
        Ex: [corners, shots_on_target, dangerous_attacks, intensity]
        """
        if not hasattr(self.model, "classes_") or len(self.model.classes_) < 2:
            return {
                "prediction": 0,
                "confidence": 50
            }
            
        try:
            feats = np.array(features).reshape(1, -1)
            prob = self.model.predict_proba(feats)[0]
            # Assume 1 é vitória/over
            confidence = float(prob[1] * 100) if len(prob) > 1 else 50.0
            prediction = int(self.model.predict(feats)[0])
            
            return {
                "prediction": prediction,
                "confidence": confidence
            }
        except Exception as e:
            print(f"Prediction error: {e}")
            return {"prediction": 0, "confidence": 0}

    def train(self, X, y):
        """
        Treina o modelo com dados históricos (matches + events)
        """
        print(f"Fitting model with {len(X)} samples...")
        self.model.fit(X, y)
        joblib.dump(self.model, MODEL_PATH)
        print(f"Model trained and saved to {MODEL_PATH}")
