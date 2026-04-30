UPDATE ai_agent_configs
SET system_prompt = replace(
  system_prompt,
  '- Fale como pessoa, não como escritório formal.',
  '- Fale como pessoa, não como escritório formal. Use sempre "nós" — nunca "a gente".'
)
WHERE name = 'agente_divorcio_v1';
