# Security fix 1: move points, bets and ledger writes to the server

## What the inspection found (verified)

**Tables** (no CHECK constraints, no indexes beyond those listed)
- `wallets`: id uuid PK, user_id uuid NOT NULL UNIQUE (FK auth.users, cascade), balance numeric default 0.00 (nullable), currency text default 'USD', created_at, updated_at.
- `transactions`: id uuid PK, user_id uuid NOT NULL (FK auth.users), type transaction_type (deposit, withdrawal, bet, win, ai_fee, refund), amount numeric NOT NULL, fee numeric default 0.00, net_amount numeric NOT NULL, description text, reference_id text, status text default 'pending' (free text), approved_by uuid (FK auth.users), approved_at, created_at.
- `bets`: id uuid PK, user_id uuid NOT NULL (FK auth.users), match_id text, match_data jsonb, selections jsonb, stake, total_odds, potential_win numeric NOT NULL, status bet_status default 'pending' (pending, won, lost, cancelled, cashout), result_data jsonb, created_at, settled_at.
- Current data: 6 wallets (balances 0–950), 5 transactions, 0 bets.

**Policies (exact)**
- wallets: SELECT own `user_id = auth.uid()`; SELECT admin `is_admin_or_master(auth.uid())`; UPDATE admin `is_admin_or_master(auth.uid())`; **UPDATE own `USING user_id = auth.uid() WITH CHECK user_id = auth.uid()`** (lets users set any balance).
- transactions: SELECT own; SELECT admin; UPDATE admin; **INSERT own `WITH CHECK user_id = auth.uid()`** (any type, amount and status, e.g. 'approved').
- bets: SELECT own; SELECT admin; UPDATE admin; **INSERT own `WITH CHECK user_id = auth.uid()`** (any stake, odds, payout).
- No DELETE policies on any of the three.

**Functions / triggers touching money:** none. Only `handle_new_user` (creates wallet at 0), `has_role`, `is_admin_or_master`, `recalculate_odds` (on `matches`).

**Browser-side writes that must be removed**
| File | Line(s) | Write |
|---|---|---|
| src/pages/SportsPage.tsx | 187, 193, 195 | insert bet, insert 'approved' bet transaction, set wallet balance |
| src/components/betting/BetSlip.tsx | 64, 87, 101 | same three |
| src/components/wallet/WalletCard.tsx | 47–63 | insert deposit as 'approved' + add to balance (self-credit) |
| src/components/wallet/WalletCard.tsx | 108–125 | insert withdrawal + deduct balance |
| src/components/betting/CashoutButton.tsx | 54, 66, 80 | update own bet to cashout (currently blocked by RLS), insert refund, add to balance |
| src/pages/AdminPage.tsx | 301–331, 425–449 | admin approve/reject + balance edits + bet settlement (allowed by admin policies, but non-atomic) |
| src/components/wallet/CurrencySwitcher.tsx | 58 | updates own `currency` only (keep, but via a narrow path) |

**Backend functions**
- `bootstrap-user`: validates the session with `auth.getUser()` (good pattern to copy).
- `ai-assistant`: **trusts `userId` from the request body**, `verify_jwt = false`, uses the service key, deducts balance non-atomically. Anyone can act as any user. Must be fixed in this same change.
- `football-proxy`, `sports-data`: no user auth (read-only public data, acceptable).

**Schema readiness:** no atomic operation, no row locking, no idempotency key, no non-negative balance guard, transaction `status` is free text, ledger is not authoritative (balance edited separately).

## Proposed design

### Migration (additive only)
1. `transactions.idempotency_key text` + unique index on `(user_id, idempotency_key)` where not null. Add `bets.idempotency_key text` with same unique index.
2. Validation trigger on `wallets`: balance must stay >= 0.
3. `public.place_bet(p_selections jsonb, p_stake numeric, p_mode text, p_idempotency_key text)` — SECURITY DEFINER, `search_path = public`:
   - `uid := auth.uid()`; reject if null or profile `is_banned`.
   - Read limits from `system_settings` (`betting_enabled`, `min_bet_amount`, `max_bet_amount` — key names to be confirmed against existing rows).
   - Look up each selection's odds from trusted server data (see below); ignore any client odds/payout.
   - `SELECT ... FROM wallets WHERE user_id = uid FOR UPDATE` (serialises concurrent requests).
   - Check balance >= stake; insert bet, insert `transactions` (type 'bet', status 'approved', idempotency_key), decrement balance — one transaction. Repeat key returns the existing bet.
4. `public.request_withdrawal(...)` and `public.cashout_bet(p_bet_id, p_key)` with the same lock + ledger pattern (cashout value computed server-side).
5. `public.admin_review_transaction(p_tx_id, p_approve)` and `public.admin_settle_bet(p_bet_id, p_result)`: check `is_admin_or_master(auth.uid())`, lock wallet, write ledger, set approved_by = auth.uid().
6. Revoke client write paths:
   - DROP POLICY "Users can update own wallet"; replace currency change with `public.set_wallet_currency(p_currency)`.
   - DROP POLICY "Users can insert own transactions" and "Users can insert own bets".
   - Keep all SELECT policies and admin policies (admin writes move to the RPCs above; admin UPDATE policies can stay for now).
   - `GRANT EXECUTE` on the RPCs to `authenticated` only.

### Trusted odds
Odds come from the `football-proxy` feed, which is not in the database today. Plan: `football-proxy` also writes each match's current odds into the existing `matches` table (id, league, home_team, away_team, odds, start_time, is_live, odds_status — columns already exist). `place_bet` reads odds from `matches` and rejects if missing, suspended, or kickoff passed. The `recalculate_odds` trigger on `matches` overwrites `home/draw/away_odds` on insert/update, so `place_bet` must read the `odds` jsonb column, or the trigger is limited to rows with `minute` set — **decision needed during implementation**.

### Deposits
Self-credited "approved" deposits are removed. Deposits become `status 'pending'` via an RPC and only an admin approval credits points (until a real payment provider exists).

### Frontend
- SportsPage and BetSlip call `supabase.rpc('place_bet', ...)` with a `crypto.randomUUID()` key; show server error messages.
- WalletCard, CashoutButton, CurrencySwitcher, AdminPage switch to their RPCs.
- `ai-assistant`: read the user from the Authorization header (`getUser`), drop `userId` from the body, and deduct via an atomic `charge_ai_fee` RPC.

### Virtual points
Points stay non-transferable: no RPC moves points between users, and no client path edits balances. Display copy should state points have no cash value — **wording to be confirmed with you**, since the app currently shows real currencies (RWF, USD) and deposit/withdrawal fees.

## Unverified / needs your decision
- Exact `system_settings` keys and values (read on implementation).
- Whether Linkabet is virtual-points only (the current UI suggests real money, MTN MoMo, withdrawals).
- How to resolve the `recalculate_odds` trigger conflict.
- Whether any data outside these files writes to these tables (search found none).

## Verification after implementing
- As a normal user: direct wallet update and transaction/bet insert are rejected.
- Two parallel `place_bet` calls with balance for one: one succeeds.
- Same idempotency key twice: one bet.
- Tampered odds in the request: server odds are used.
- Admin approve/settle still works.
