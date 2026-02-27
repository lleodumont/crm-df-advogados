/*
  # Adicionar campo de faixa de renda familiar

  1. Alterações
    - Adiciona coluna `family_income_range` na tabela `leads`
    - Tipo: texto com valores predefinidos
    - Valores permitidos:
      - 'ate_10k': Até R$ 10 mil
      - '10k_25k': R$ 10 mil a R$ 25 mil
      - '25k_50k': R$ 25 mil a R$ 50 mil
      - 'acima_50k': Acima de R$ 50 mil
      - 'prefiro_nao_informar': Prefiro informar na conversa
    - Campo opcional (nullable)
    - Sem valor padrão

  2. Motivo
    - Permitir qualificação mais precisa dos leads baseada na renda familiar
    - Auxiliar na segmentação e priorização de atendimento
    - Melhorar o scoring de leads
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'family_income_range'
  ) THEN
    ALTER TABLE leads 
    ADD COLUMN family_income_range text;

    ALTER TABLE leads
    ADD CONSTRAINT family_income_range_check 
    CHECK (
      family_income_range IS NULL OR 
      family_income_range IN (
        'ate_10k',
        '10k_25k',
        '25k_50k',
        'acima_50k',
        'prefiro_nao_informar'
      )
    );
  END IF;
END $$;