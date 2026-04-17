-- supabase/migrations/20260417000003_add_marketing_tables.sql

-- ── EDUZZ SALES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eduzz_sales (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  eduzz_transaction_id  text        UNIQUE NOT NULL,
  product_id            text,
  product_name          text,
  buyer_name            text,
  buyer_email           text,
  buyer_phone           text,        -- dígitos limpos (sem formatação)
  amount                numeric(10,2) NOT NULL DEFAULT 0,
  status                text        NOT NULL DEFAULT 'approved',
  utm_campaign          text,
  utm_source            text,
  utm_medium            text,
  utm_content           text,
  lead_id               uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  raw_payload           jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eduzz_sales_lead_id      ON public.eduzz_sales(lead_id);
CREATE INDEX IF NOT EXISTS idx_eduzz_sales_utm_campaign  ON public.eduzz_sales(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_eduzz_sales_buyer_phone   ON public.eduzz_sales(buyer_phone);
CREATE INDEX IF NOT EXISTS idx_eduzz_sales_created_at    ON public.eduzz_sales(created_at DESC);

ALTER TABLE public.eduzz_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales"
  ON public.eduzz_sales FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages sales"
  ON public.eduzz_sales FOR ALL TO service_role USING (true);

-- ── META ADS CACHE ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_ads_cache (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key   text        UNIQUE NOT NULL,  -- '{account}_{level}_{since}_{until}'
  data        jsonb       NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_cache_key ON public.meta_ads_cache(cache_key);

ALTER TABLE public.meta_ads_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view meta cache"
  ON public.meta_ads_cache FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages meta cache"
  ON public.meta_ads_cache FOR ALL TO service_role USING (true);
