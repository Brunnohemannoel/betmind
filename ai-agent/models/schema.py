from sqlalchemy import Column, String, Integer, Float, Boolean, JSON, TIMESTAMP, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from config import Base

class Team(Base):
    __tablename__ = "teams"
    id = Column(UUID(as_uuid=True), primary_key=True)
    name = Column(String, unique=True)
    logo_url = Column(String)

class Match(Base):
    __tablename__ = "matches_live"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    external_match_id = Column(String, unique=True)
    home_team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"))
    away_team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"))
    league = Column(String)
    home_score = Column(Integer, default=0)
    away_score = Column(Integer, default=0)
    minute = Column(Integer, default=0)
    status = Column(String, default="live")
    kickoff_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)

class MatchesHistory(Base):
    __tablename__ = "matches_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    external_match_id = Column(String, unique=True)
    match_date = Column(TIMESTAMP)
    league = Column(String)
    home_team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"))
    away_team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"))
    home_score = Column(Integer)
    away_score = Column(Integer)

class Event(Base):
    __tablename__ = "events"
    id = Column(UUID(as_uuid=True), primary_key=True)
    match_id = Column(UUID(as_uuid=True), ForeignKey("matches_history.id"))
    minute = Column(Integer)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"))
    type = Column(String)

class AiInsight(Base):
    __tablename__ = "ai_insights"
    id = Column(UUID(as_uuid=True), primary_key=True)
    match_live_id = Column(UUID(as_uuid=True), ForeignKey("matches_live.id"))
    insight = Column(String)
    suggestion = Column(String)
    trend = Column(String, default="estavel")
    pressure_score = Column(Integer, default=0)
    dominance_score = Column(Integer, default=0)
    momentum_score = Column(Integer, default=0)
    confidence = Column(Float, default=0.0)
    model_mode = Column(String, default="hybrid")
    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True)
    avatar_url = Column(String)
    reputation = Column(Integer, default=0)
    badges = Column(JSON, default=[]) # Lista de medalhas
    created_at = Column(TIMESTAMP, default=datetime.now)

class Post(Base):
    __tablename__ = "community_posts"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    content = Column(String, nullable=False)
    match_id = Column(UUID(as_uuid=True), ForeignKey("matches_live.id"), nullable=True) # Link opcional para um jogo
    bet_data = Column(JSON, nullable=True) # Detalhes da bet (mercado, odd, etc)
    ai_validated = Column(Boolean, default=False)
    ai_score = Column(Float, default=0.0)
    created_at = Column(TIMESTAMP, default=datetime.now)
    
class Interaction(Base):
    __tablename__ = "community_interactions"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    post_id = Column(UUID(as_uuid=True), ForeignKey("community_posts.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    type = Column(String) # 'like', 'comment', 'repost'
    content = Column(String, nullable=True) # Para comentários
    created_at = Column(TIMESTAMP, default=datetime.now)
