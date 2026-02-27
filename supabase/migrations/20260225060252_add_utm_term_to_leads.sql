/*
  # Adicionar campo UTM Term aos leads

  1. Alterações
    - Adiciona coluna `utm_term` na tabela `leads`
    - Tipo: texto
    - Campo opcional (nullable)
    - Sem valor padrão

  2. Motivo
    - Completar o rastreamento de UTM parameters para análise completa de campanhas
    - Permitir rastrear palavras-chave e termos de pesquisa de anúncios
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'utm_term'
  ) THEN
    ALTER TABLE leads 
    ADD COLUMN utm_term text;
  END IF;
END $$;