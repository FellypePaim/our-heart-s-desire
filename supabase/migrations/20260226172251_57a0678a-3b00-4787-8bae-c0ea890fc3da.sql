
-- Tabela de saldo de créditos dos Masters
CREATE TABLE public.credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  balance integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único por user_id (cada Master tem um registro)
CREATE UNIQUE INDEX idx_credits_user_id ON public.credits (user_id);

-- Tabela de histórico de transações
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL DEFAULT 'grant',
  target_user_id uuid,
  granted_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions (user_id);

-- Trigger para updated_at na tabela credits
CREATE TRIGGER update_credits_updated_at
  BEFORE UPDATE ON public.credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: credits
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_credits" ON public.credits
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "own_credits_select" ON public.credits
  FOR SELECT USING (user_id = auth.uid());

-- RLS: credit_transactions
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_credit_transactions" ON public.credit_transactions
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "own_credit_transactions_select" ON public.credit_transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "own_credit_transactions_insert" ON public.credit_transactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Função atômica para gastar crédito e renovar revendedor
CREATE OR REPLACE FUNCTION public.spend_credit_renew_reseller(
  _master_user_id uuid,
  _reseller_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_balance integer;
  _current_expiry timestamptz;
  _new_expiry timestamptz;
BEGIN
  -- Check balance
  SELECT balance INTO _current_balance
  FROM public.credits
  WHERE user_id = _master_user_id
  FOR UPDATE;

  IF _current_balance IS NULL OR _current_balance < 1 THEN
    RAISE EXCEPTION 'Saldo de créditos insuficiente';
  END IF;

  -- Verify reseller belongs to master
  IF NOT is_reseller_of_master(_reseller_user_id, _master_user_id) THEN
    RAISE EXCEPTION 'Revendedor não pertence a este Master';
  END IF;

  -- Calculate new expiry (extend from current if still active, otherwise from now)
  SELECT plan_expires_at INTO _current_expiry
  FROM public.profiles
  WHERE user_id = _reseller_user_id;

  IF _current_expiry IS NOT NULL AND _current_expiry > now() THEN
    _new_expiry := _current_expiry + interval '30 days';
  ELSE
    _new_expiry := now() + interval '30 days';
  END IF;

  -- Decrement balance
  UPDATE public.credits
  SET balance = balance - 1
  WHERE user_id = _master_user_id;

  -- Update reseller plan
  UPDATE public.profiles
  SET plan_type = 'monthly', plan_expires_at = _new_expiry
  WHERE user_id = _reseller_user_id;

  -- Log transaction
  INSERT INTO public.credit_transactions (user_id, amount, type, target_user_id)
  VALUES (_master_user_id, -1, 'spend', _reseller_user_id);
END;
$$;
