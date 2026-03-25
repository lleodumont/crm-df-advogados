-- Adiciona coluna de busca FTS na tabela leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Cria índice GIN para performance
CREATE INDEX IF NOT EXISTS idx_leads_search_vector ON public.leads USING gin(search_vector);

-- Função para atualizar o vetor de busca
CREATE OR REPLACE FUNCTION public.update_lead_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese',
    COALESCE(NEW.full_name, '') || ' ' ||
    COALESCE(NEW.phone, '') || ' ' ||
    COALESCE(NEW.email, '') || ' ' ||
    COALESCE(NEW.campaign, '') || ' ' ||
    COALESCE(NEW.city, '') || ' ' ||
    COALESCE(NEW.notes, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para manter o vetor atualizado
DROP TRIGGER IF EXISTS trg_leads_search_vector ON public.leads;
CREATE TRIGGER trg_leads_search_vector
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.update_lead_search_vector();

-- Atualiza registros existentes
UPDATE public.leads SET search_vector = to_tsvector('portuguese',
  COALESCE(full_name, '') || ' ' ||
  COALESCE(phone, '') || ' ' ||
  COALESCE(email, '') || ' ' ||
  COALESCE(campaign, '') || ' ' ||
  COALESCE(city, '') || ' ' ||
  COALESCE(notes, '')
);
