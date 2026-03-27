-- Table: bet_slip
-- Armazena os itens que o usuário adicionou ao seu bilhete atual (carrinho)
CREATE TABLE IF NOT EXISTS public.bet_slip (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    match_id TEXT NOT NULL,
    odd NUMERIC(10, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('1', 'X', '2')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: bets
-- Armazena os bilhetes de aposta finalizados pelo usuário
CREATE TABLE IF NOT EXISTS public.bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_odd NUMERIC(10, 2) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    potential_return NUMERIC(15, 2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_bet_slip_user_id ON public.bet_slip(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON public.bets(user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_bet_slip_user_id ON public.bet_slip(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON public.bets(user_id);
