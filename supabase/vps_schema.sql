-- Clean BetMind schema for raw PostgreSQL
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default uuid_generate_v4(), email text unique);

-- Teams
create table if not exists public.teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  logo_url text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Team Logos
create table if not exists public.team_logos (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references public.teams(id) on delete cascade,
  provider text not null,
  logo_url text not null,
  fetched_at timestamptz not null default now(),
  unique (team_id, provider)
);

-- Matches History
create table if not exists public.matches_history (
  id uuid primary key default uuid_generate_v4(),
  external_match_id text unique,
  match_date timestamptz not null,
  league text not null,
  season text,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  home_score int,
  away_score int,
  created_at timestamptz not null default now()
);

-- Events
create table if not exists public.events (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null references public.matches_history(id) on delete cascade,
  minute int,
  team_id uuid references public.teams(id),
  type text not null,
  created_at timestamptz not null default now()
);

-- Match Stats
create table if not exists public.match_stats (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null unique references public.matches_history(id) on delete cascade,
  goals_home int not null default 0,
  goals_away int not null default 0,
  corners_home int not null default 0,
  corners_away int not null default 0,
  fouls_home int not null default 0,
  fouls_away int not null default 0,
  cards_home int not null default 0,
  cards_away int not null default 0,
  updated_at timestamptz not null default now()
);

-- Team Stats
create table if not exists public.team_stats (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null unique references public.teams(id) on delete cascade,
  avg_goals numeric(6,3) not null default 0,
  avg_corners numeric(6,3) not null default 0,
  avg_cards numeric(6,3) not null default 0,
  win_rate numeric(6,3) not null default 0,
  updated_at timestamptz not null default now()
);

-- Matches Live
create table if not exists public.matches_live (
  id uuid primary key default uuid_generate_v4(),
  external_match_id text unique,
  league text not null,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  home_score int not null default 0,
  away_score int not null default 0,
  minute int not null default 0,
  status text not null default 'live',
  status_detail text,
  kickoff_at timestamp with time zone,
  odds_home numeric(10,3),
  odds_draw numeric(10,3),
  odds_away numeric(10,3),
  is_hot boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- AI Insights
create table if not exists public.ai_insights (
  id uuid primary key default uuid_generate_v4(),
  match_live_id uuid not null references public.matches_live(id) on delete cascade,
  insight text not null,
  suggestion text not null,
  trend text not null default 'estavel',
  pressure_score integer not null default 0,
  dominance_score integer not null default 0,
  momentum_score integer not null default 0,
  value_bet boolean not null default false,
  hot_game boolean not null default false,
  comeback_signal boolean not null default false,
  ideal_moment boolean not null default false,
  risk_high boolean not null default false,
  confidence numeric not null default 0,
  model_mode text not null default 'hybrid',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Alerts
create table if not exists public.alerts (
  id uuid primary key default uuid_generate_v4(),
  match_live_id uuid not null references public.matches_live(id) on delete cascade,
  type text not null,
  message text not null,
  score int not null default 0,
  created_at timestamptz not null default now()
);

-- Live Events
create table if not exists public.live_events (
  id uuid primary key default uuid_generate_v4(),
  match_live_id uuid not null references public.matches_live(id) on delete cascade,
  provider_event_id text,
  event_type text not null,
  minute integer,
  pressure_delta integer not null default 0,
  payload jsonb,
  created_at timestamp with time zone not null default now()
);

-- Favorites
create table if not exists public.favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, match_id)
);
