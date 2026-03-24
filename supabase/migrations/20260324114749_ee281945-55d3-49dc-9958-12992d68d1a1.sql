-- Support full agenda (live/upcoming/finished) + AI analyst outputs
ALTER TABLE public.matches_live
ADD COLUMN IF NOT EXISTS kickoff_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS status_detail text;

-- Ensure upsert key for provider events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'matches_live_external_match_id_key'
      AND conrelid = 'public.matches_live'::regclass
  ) THEN
    ALTER TABLE public.matches_live
    ADD CONSTRAINT matches_live_external_match_id_key UNIQUE (external_match_id);
  END IF;
END $$;

-- AI generated insight per live match (latest insight can be selected by updated_at)
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_live_id uuid NOT NULL REFERENCES public.matches_live(id) ON DELETE CASCADE,
  insight text NOT NULL,
  suggestion text NOT NULL,
  trend text NOT NULL DEFAULT 'estavel',
  pressure_score integer NOT NULL DEFAULT 0,
  dominance_score integer NOT NULL DEFAULT 0,
  momentum_score integer NOT NULL DEFAULT 0,
  value_bet boolean NOT NULL DEFAULT false,
  hot_game boolean NOT NULL DEFAULT false,
  comeback_signal boolean NOT NULL DEFAULT false,
  ideal_moment boolean NOT NULL DEFAULT false,
  risk_high boolean NOT NULL DEFAULT false,
  confidence numeric NOT NULL DEFAULT 0,
  model_mode text NOT NULL DEFAULT 'hybrid',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_match_live_id ON public.ai_insights(match_live_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_updated_at ON public.ai_insights(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_hot_game ON public.ai_insights(hot_game);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_insights' AND policyname = 'Authenticated can read ai insights'
  ) THEN
    CREATE POLICY "Authenticated can read ai insights"
    ON public.ai_insights
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_insights' AND policyname = 'Admins can manage ai insights'
  ) THEN
    CREATE POLICY "Admins can manage ai insights"
    ON public.ai_insights
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Optional live event snapshots feeding the hybrid model
CREATE TABLE IF NOT EXISTS public.live_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_live_id uuid NOT NULL REFERENCES public.matches_live(id) ON DELETE CASCADE,
  provider_event_id text,
  event_type text NOT NULL,
  minute integer,
  pressure_delta integer NOT NULL DEFAULT 0,
  payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_events_match_live_id ON public.live_events(match_live_id);
CREATE INDEX IF NOT EXISTS idx_live_events_created_at ON public.live_events(created_at DESC);

ALTER TABLE public.live_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'live_events' AND policyname = 'Authenticated can read live events'
  ) THEN
    CREATE POLICY "Authenticated can read live events"
    ON public.live_events
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'live_events' AND policyname = 'Admins can manage live events'
  ) THEN
    CREATE POLICY "Admins can manage live events"
    ON public.live_events
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Keep updated_at consistent
DROP TRIGGER IF EXISTS update_ai_insights_updated_at ON public.ai_insights;
CREATE TRIGGER update_ai_insights_updated_at
BEFORE UPDATE ON public.ai_insights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();