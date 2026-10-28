-- Virtual wallet hardening: all user balance and bet mutations are atomic server-side operations.
-- This migration is intentionally additive to the existing schema and keeps all points simulated/non-cash.

ALTER TABLE public.wallets
  ALTER COLUMN balance SET DEFAULT 0,
  ALTER COLUMN balance SET NOT NULL;
ALTER TABLE public.wallets
  DROP CONSTRAINT IF EXISTS wallets_balance_nonnegative_check;
ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_balance_nonnegative_check CHECK (balance >= 0);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_idempotency_key_uq
  ON public.transactions (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bets_user_idempotency_key_uq
  ON public.bets (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Remove user-controlled ledger, bet and balance writes. Admin access is retained for
-- existing moderation screens; ordinary users must use the narrowly-scoped RPCs below.
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own bets" ON public.bets;
DROP POLICY IF EXISTS "Admins can insert transactions" ON public.transactions;
CREATE POLICY "Admins can insert transactions" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_wallet_currency(p_currency text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_currency NOT IN ('USD','GBP','EUR','NGN','GHS','KES','ZAR','TZS','UGX','RWF','ETB','XAF','XOF','CDF','MZN','ZMW','MWK','BWP','INR','PKR','BDT','PHP','BRL','MXN','AED','SAR','EGP','MAD','AUD','JPY','CNY','RUB','TRY') THEN
    RAISE EXCEPTION 'Unsupported display currency';
  END IF;
  UPDATE public.wallets SET currency = p_currency, updated_at = now() WHERE user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.place_bet(
  p_selections jsonb,
  p_stake numeric,
  p_mode text,
  p_idempotency_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_wallet public.wallets%ROWTYPE;
  v_existing uuid;
  v_bet_id uuid;
  v_selection jsonb;
  v_match_id text;
  v_pick text;
  v_odds numeric;
  v_total_odds numeric := 1;
  v_match_data jsonb := '{}'::jsonb;
  v_normalized jsonb := '[]'::jsonb;
  v_cache_match jsonb;
  v_match public.matches%ROWTYPE;
  v_balance numeric;
  v_min numeric := 1;
  v_max numeric := 10000;
  v_enabled boolean := true;
  v_start_time timestamptz;
  v_is_live boolean := false;
  v_home text;
  v_away text;
  v_league text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 OR length(p_idempotency_key) > 128 THEN
    RAISE EXCEPTION 'A valid idempotency key is required';
  END IF;
  IF p_mode NOT IN ('Singles','Accumulator') THEN RAISE EXCEPTION 'Unsupported bet mode'; END IF;
  IF jsonb_typeof(p_selections) <> 'array' OR jsonb_array_length(p_selections) = 0 OR jsonb_array_length(p_selections) > 20 THEN
    RAISE EXCEPTION 'Select between 1 and 20 outcomes';
  END IF;
  IF p_mode = 'Singles' AND jsonb_array_length(p_selections) <> 1 THEN
    RAISE EXCEPTION 'Singles bets must contain exactly one outcome';
  END IF;

  SELECT id INTO v_existing FROM public.bets
    WHERE user_id = uid AND idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND COALESCE(is_banned, false)) THEN
    RAISE EXCEPTION 'Account is restricted';
  END IF;
  SELECT COALESCE((value #>> '{}')::boolean, true) INTO v_enabled
    FROM public.system_settings WHERE key = 'betting_enabled';
  IF NOT COALESCE(v_enabled, true) THEN RAISE EXCEPTION 'Betting is disabled'; END IF;
  SELECT COALESCE((value #>> '{}')::numeric, 1) INTO v_min
    FROM public.system_settings WHERE key = 'min_bet_amount';
  SELECT COALESCE((value #>> '{}')::numeric, 10000) INTO v_max
    FROM public.system_settings WHERE key = 'max_bet_amount';
  IF p_stake IS NULL OR p_stake <= 0 OR p_stake <> round(p_stake, 2) THEN RAISE EXCEPTION 'Invalid stake'; END IF;
  IF p_stake < COALESCE(v_min, 1) THEN RAISE EXCEPTION 'Stake is below the minimum'; END IF;
  IF p_stake > COALESCE(v_max, 10000) THEN RAISE EXCEPTION 'Stake exceeds the maximum'; END IF;

  -- Lock first so simultaneous bets cannot spend the same virtual points.
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  v_balance := v_wallet.balance;

  FOR v_selection IN SELECT value FROM jsonb_array_elements(p_selections)
  LOOP
    v_match_id := v_selection->>'matchId';
    v_pick := v_selection->>'selection';
    IF v_match_id IS NULL OR v_pick IS NULL OR v_pick NOT IN ('home','draw','away') THEN RAISE EXCEPTION 'Invalid selection'; END IF;

    v_cache_match := NULL;
    SELECT item INTO v_cache_match
    FROM public.sports_cache c, LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(c.payload) = 'array' THEN c.payload ELSE '[]'::jsonb END
    ) item
    WHERE c.cache_key = 'fd:matches' AND item->>'id' = v_match_id
    LIMIT 1;

    IF v_cache_match IS NOT NULL THEN
      IF COALESCE((v_cache_match->>'startTime')::timestamptz, now() + interval '1 day') <= now()
         AND COALESCE((v_cache_match->>'live')::boolean, false) = false THEN
        RAISE EXCEPTION 'Match has already started';
      END IF;
      IF COALESCE((v_cache_match->>'live')::boolean, false) = true THEN
        RAISE EXCEPTION 'Live selections are temporarily unavailable';
      END IF;
      IF v_pick = 'home' THEN v_odds := NULLIF(v_cache_match->'odds'->>'home','')::numeric;
      ELSIF v_pick = 'draw' THEN v_odds := NULLIF(v_cache_match->'odds'->>'draw','')::numeric;
      ELSE v_odds := NULLIF(v_cache_match->'odds'->>'away','')::numeric;
      END IF;
      v_home := v_cache_match->>'home';
      v_away := v_cache_match->>'away';
      v_league := v_cache_match->>'league';
      v_start_time := NULLIF(v_cache_match->>'startTime','')::timestamptz;
      v_is_live := COALESCE((v_cache_match->>'live')::boolean, false);
    ELSE
      SELECT * INTO v_match FROM public.matches WHERE id = v_match_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Match not found or odds are unavailable'; END IF;
      IF v_match.odds_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Odds are suspended'; END IF;
      IF v_match.is_live OR v_match.start_time <= now() THEN RAISE EXCEPTION 'Live or started matches are unavailable'; END IF;
      IF v_pick = 'home' THEN v_odds := COALESCE(NULLIF(v_match.odds->>'home','')::numeric, v_match.home_odds);
      ELSIF v_pick = 'draw' THEN v_odds := COALESCE(NULLIF(v_match.odds->>'draw','')::numeric, v_match.draw_odds);
      ELSE v_odds := COALESCE(NULLIF(v_match.odds->>'away','')::numeric, v_match.away_odds);
      END IF;
      v_home := COALESCE(v_match.home_team->>'name', 'Home');
      v_away := COALESCE(v_match.away_team->>'name', 'Away');
      v_league := v_match.league;
      v_start_time := v_match.start_time;
      v_is_live := v_match.is_live;
    END IF;

    IF v_odds IS NULL OR v_odds <= 1 OR v_odds > 1000 THEN RAISE EXCEPTION 'Valid current odds are unavailable'; END IF;
    v_total_odds := v_total_odds * v_odds;
    v_match_data := jsonb_build_object('homeTeam', jsonb_build_object('name', COALESCE(v_home,'Home')),
      'awayTeam', jsonb_build_object('name', COALESCE(v_away,'Away')), 'league', v_league, 'sport', 'football');
    v_normalized := v_normalized || jsonb_build_array(jsonb_build_object(
      'matchId', v_match_id, 'selection', v_pick, 'odds', v_odds,
      'homeTeam', COALESCE(v_home,'Home'), 'awayTeam', COALESCE(v_away,'Away')));
  END LOOP;

  IF p_stake > v_balance THEN RAISE EXCEPTION 'Insufficient virtual points'; END IF;

  INSERT INTO public.bets (user_id, match_id, match_data, selections, stake, total_odds, potential_win, status, idempotency_key)
  VALUES (uid, v_normalized->0->>'matchId', v_match_data, v_normalized, p_stake, v_total_odds,
    round(p_stake * v_total_odds, 2), 'pending', p_idempotency_key)
  RETURNING id INTO v_bet_id;

  INSERT INTO public.transactions (user_id, type, amount, fee, net_amount, description, status, reference_id, idempotency_key)
  VALUES (uid, 'bet', p_stake, 0, p_stake, 'Virtual points staked on simulated sports outcome',
    'approved', v_bet_id::text, p_idempotency_key);

  UPDATE public.wallets SET balance = balance - p_stake, updated_at = now() WHERE user_id = uid;
  RETURN v_bet_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cashout_bet(p_bet_id uuid, p_idempotency_key text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_wallet public.wallets%ROWTYPE;
  v_bet public.bets%ROWTYPE;
  v_existing numeric;
  v_factor numeric;
  v_value numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 OR length(p_idempotency_key) > 128 THEN RAISE EXCEPTION 'Valid idempotency key required'; END IF;
  SELECT amount INTO v_existing FROM public.transactions WHERE user_id = uid AND idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND OR v_bet.status <> 'pending' THEN RAISE EXCEPTION 'Bet is not eligible for cashout'; END IF;

  v_factor := GREATEST(0.40, 0.85 - (EXTRACT(EPOCH FROM (now() - v_bet.created_at)) / 3600) * 0.05);
  v_value := round(GREATEST(v_bet.stake * 0.5, v_bet.stake + (v_bet.potential_win - v_bet.stake) * v_factor), 2);

  UPDATE public.bets SET status = 'cashout', settled_at = now(), result_data = jsonb_build_object('cashout_value', v_value)
    WHERE id = v_bet.id;
  UPDATE public.wallets SET balance = balance + v_value, updated_at = now() WHERE user_id = uid;
  INSERT INTO public.transactions (user_id, type, amount, fee, net_amount, description, status, reference_id, idempotency_key)
    VALUES (uid, 'refund', v_value, 0, v_value, 'Virtual points cashout', 'approved', v_bet.id::text, p_idempotency_key);
  RETURN v_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.charge_ai_fee(p_description text DEFAULT 'AI assistant virtual-points usage')
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_wallet public.wallets%ROWTYPE;
  v_fee numeric := 0.50;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF public.is_admin_or_master(uid) THEN RETURN 0; END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_wallet.balance < v_fee THEN RAISE EXCEPTION 'Insufficient virtual points'; END IF;
  UPDATE public.wallets SET balance = balance - v_fee, updated_at = now() WHERE user_id = uid;
  INSERT INTO public.transactions (user_id, type, amount, fee, net_amount, description, status)
    VALUES (uid, 'ai_fee', v_fee, 0, v_fee, left(COALESCE(p_description, 'AI assistant virtual-points usage'), 160), 'approved');
  RETURN v_fee;
END;
$$;


-- Remove every direct UPDATE policy on financial tables; admin mutations also go through
-- atomic functions so balance, bet status and ledger entries cannot drift apart.
DO $
DECLARE p record;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('wallets','transactions','bets') AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $;

CREATE OR REPLACE FUNCTION public.admin_review_transaction(p_tx_id uuid, p_approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  uid uuid := auth.uid();
  v_tx public.transactions%ROWTYPE;
BEGIN
  IF uid IS NULL OR NOT public.is_admin_or_master(uid) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_tx_id FOR UPDATE;
  IF NOT FOUND OR v_tx.type <> 'withdrawal' OR v_tx.status <> 'pending' THEN
    RAISE EXCEPTION 'Transaction is not a pending withdrawal';
  END IF;
  IF p_approve THEN
    UPDATE public.transactions SET status = 'approved', approved_by = uid, approved_at = now() WHERE id = p_tx_id;
  ELSE
    PERFORM 1 FROM public.wallets WHERE user_id = v_tx.user_id FOR UPDATE;
    UPDATE public.wallets SET balance = balance + v_tx.amount, updated_at = now() WHERE user_id = v_tx.user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    UPDATE public.transactions SET status = 'rejected', approved_by = uid, approved_at = now() WHERE id = p_tx_id;
    INSERT INTO public.transactions (user_id, type, amount, fee, net_amount, description, status, reference_id, approved_by, approved_at)
      VALUES (v_tx.user_id, 'refund', v_tx.amount, 0, v_tx.amount, 'Virtual-point refund: withdrawal rejected',
        'approved', v_tx.id::text, uid, now());
  END IF;
END;
$;

CREATE OR REPLACE FUNCTION public.admin_settle_bet(p_bet_id uuid, p_result text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  uid uuid := auth.uid();
  v_bet public.bets%ROWTYPE;
BEGIN
  IF uid IS NULL OR NOT public.is_admin_or_master(uid) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_result NOT IN ('won','lost') THEN RAISE EXCEPTION 'Invalid settlement result'; END IF;
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id FOR UPDATE;
  IF NOT FOUND OR v_bet.status <> 'pending' THEN RAISE EXCEPTION 'Bet is not pending'; END IF;
  PERFORM 1 FROM public.wallets WHERE user_id = v_bet.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  UPDATE public.bets SET status = p_result, settled_at = now(),
    result_data = jsonb_build_object('settled_by', uid, 'result', p_result) WHERE id = p_bet_id;
  IF p_result = 'won' THEN
    UPDATE public.wallets SET balance = balance + v_bet.potential_win, updated_at = now() WHERE user_id = v_bet.user_id;
    INSERT INTO public.transactions (user_id, type, amount, fee, net_amount, description, status, reference_id, approved_by, approved_at)
      VALUES (v_bet.user_id, 'win', v_bet.potential_win, 0, v_bet.potential_win,
        'Virtual points won on simulated sports outcome', 'approved', v_bet.id::text, uid, now());
  END IF;
END;
$;

REVOKE ALL ON FUNCTION public.admin_review_transaction(uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_settle_bet(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_transaction(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_settle_bet(uuid,text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_wallet_currency(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.place_bet(jsonb,numeric,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cashout_bet(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.charge_ai_fee(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_wallet_currency(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_bet(jsonb,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cashout_bet(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.charge_ai_fee(text) TO authenticated;
