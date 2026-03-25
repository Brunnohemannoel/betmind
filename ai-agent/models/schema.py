from sqlalchemy import Column, String, Integer, Float, Boolean, JSON, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from config import Base

class Team(Base):
    __tablename__ = "teams"
    id = Column(String, primary_key=True)
    name = Column(String, unique=True)
    logo_url = Column(String)

class Match(Base):
    __tablename__ = "matches_live"
    
    id = Column(String, primary_key=True)
    external_match_id = Column(String, unique=True)
    home_team_id = Column(String, ForeignKey("teams.id"))
    away_team_id = Column(String, ForeignKey("teams.id"))
    league = Column(String)
    home_score = Column(Integer, default=0)
    away_score = Column(Integer, default=0)
    minute = Column(Integer, default=0)
    status = Column(String, default="live")
    kickoff_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)

class MatchesHistory(Base):
    __tablename__ = "matches_history"
    
    id = Column(String, primary_key=True)
    external_match_id = Column(String, unique=True)
    match_date = Column(TIMESTAMP)
    league = Column(String)
    home_team_id = Column(String, ForeignKey("teams.id"))
    away_team_id = Column(String, ForeignKey("teams.id"))
    home_score = Column(Integer)
    away_score = Column(Integer)

class Event(Base):
    __tablename__ = "events"
    id = Column(String, primary_key=True)
    match_id = Column(String, ForeignKey("matches_history.id"))
    minute = Column(Integer)
    team_id = Column(String, ForeignKey("teams.id"))
    type = Column(String)

class AiInsight(Base):
    __tablename__ = "ai_insights"
    id = Column(String, primary_key=True)
    match_live_id = Column(String, ForeignKey("matches_live.id"))
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
