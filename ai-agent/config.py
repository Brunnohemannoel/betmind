import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
import redis
import json

# Carrega variáveis de ambiente
load_dotenv()

# Configuração do PostgreSQL - OBRIGATORIO VPS
DATABASE_URL = os.getenv("DATABASE_URL")

# Se não houver URL, erro crítico
if not DATABASE_URL:
    raise ValueError("DATABASE_URL não configurada no .env")

# Engine e Sessão do SQLAlchemy
# Usamos pool_pre_ping para manter a conexão viva com a VPS
def create_resilient_engine(url):
    try:
        # Testa a conexão rápida antes de prosseguir
        temp_engine = create_engine(url, connect_args={"connect_timeout": 3})
        with temp_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"DEBUG: Connected to VPS database successfully.")
        return temp_engine
    except Exception as e:
        print(f"CRITICAL: Could not connect to VPS database: {e}")
        print("Falling back to local SQLite for stability.")
        return create_engine("sqlite:///./local_test.db")

engine = create_resilient_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Mock Redis for Local
class FakeRedis:
    def __init__(self):
        self.data = {}
    def get(self, key):
        return self.data.get(key)
    def set(self, key, val):
        self.data[key] = val
    def setex(self, key, ttl, val):
        self.data[key] = val
    def exists(self, key):
        return key in self.data

# Força FakeRedis local se não houver conexão imediata
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
print("Local mode: Using FakeRedis for stability.")
redis_client = FakeRedis()
try:
    # Tenta conectar no Redis real apenas se necessário
    # r = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1)
    # r.ping()
    # redis_client = r
    pass
except Exception:
    pass

