import numpy as np
import pandas as pd
from models.predictor import Predictor
from services.data_loader import DataLoader

def train_model():
    """
    Script para automatizar o carregamento de dados históricos e treinar o modelo
    """
    print("Initiating real training sequence (Nível 2)...")
    
    loader = DataLoader()
    try:
        X, y = loader.get_training_data()
        
        if len(X) < 10:
            print("Insufficient data for training. Using fallback dummy data.")
            # Dummy logic fallback if DB is empty
            X = np.random.randint(0, 15, size=(100, 4))
            y = ((X[:, 0] * 2 + X[:, 1] * 3 + X[:, 2]) > 30).astype(int)
        else:
            X = np.array(X)
            y = np.array(y)
            print(f"Loaded {len(X)} samples from database.")

        predictor = Predictor()
        predictor.train(X, y)
        print("Training finished. Model saved successfully.")
    except Exception as e:
        print(f"Error during training: {e}")
    finally:
        loader.close()

if __name__ == "__main__":
    train_model()
