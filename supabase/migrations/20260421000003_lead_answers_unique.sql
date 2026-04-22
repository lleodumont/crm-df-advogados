DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lead_answers_lead_id_question_key_unique'
  ) THEN
    ALTER TABLE lead_answers
      ADD CONSTRAINT lead_answers_lead_id_question_key_unique
      UNIQUE (lead_id, question_key);
  END IF;
END$$;
