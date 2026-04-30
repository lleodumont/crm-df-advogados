UPDATE ai_agent_configs
SET system_prompt = replace(
  system_prompt,
  '- Use "a gente" no lugar de "nós". Fale como pessoa, não como escritório.',
  '- Fale como pessoa, não como escritório formal.'
)
WHERE name = 'agente_divorcio_v1';
