
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.hn_payment_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL DEFAULT 'paddle',
  provider_product_id TEXT,
  provider_price_id TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  interval TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hn_payment_products TO authenticated;
GRANT ALL ON public.hn_payment_products TO service_role;
ALTER TABLE public.hn_payment_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products viewable by authenticated" ON public.hn_payment_products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "products admin manage" ON public.hn_payment_products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.hn_payment_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paddle',
  provider_customer_id TEXT,
  email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hn_payment_customers TO authenticated;
GRANT ALL ON public.hn_payment_customers TO service_role;
ALTER TABLE public.hn_payment_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own customer view" ON public.hn_payment_customers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own customer manage" ON public.hn_payment_customers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.hn_payment_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.hn_payment_products(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'paddle',
  provider_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hn_payment_subscriptions TO authenticated;
GRANT ALL ON public.hn_payment_subscriptions TO service_role;
ALTER TABLE public.hn_payment_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subs view" ON public.hn_payment_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "subs admin manage" ON public.hn_payment_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.hn_payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.hn_payment_products(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.hn_payment_subscriptions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'paddle',
  provider_transaction_id TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hn_payment_transactions TO authenticated;
GRANT ALL ON public.hn_payment_transactions TO service_role;
ALTER TABLE public.hn_payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx view" ON public.hn_payment_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tx admin manage" ON public.hn_payment_transactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_hn_payment_products_updated BEFORE UPDATE ON public.hn_payment_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hn_payment_customers_updated BEFORE UPDATE ON public.hn_payment_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hn_payment_subscriptions_updated BEFORE UPDATE ON public.hn_payment_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hn_payment_transactions_updated BEFORE UPDATE ON public.hn_payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_hn_payment_subs_user ON public.hn_payment_subscriptions(user_id);
CREATE INDEX idx_hn_payment_tx_user ON public.hn_payment_transactions(user_id);
CREATE INDEX idx_hn_payment_customers_user ON public.hn_payment_customers(user_id);
