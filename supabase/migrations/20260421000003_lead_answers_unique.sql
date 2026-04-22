ALTER TABLE lead_answers
  ADD CONSTRAINT IF NOT EXISTS lead_answers_lead_id_question_key_unique
  UNIQUE (lead_id, question_key);
