-- Adiciona reação com urgência quando guarda/pensão não foram definidas
UPDATE ai_agent_configs
SET system_prompt = replace(
  system_prompt,
  '      - Já conversaram sobre guarda e pensão?',
  '      - Já conversaram sobre guarda e pensão?
      → SE não conversaram ainda sobre guarda/pensão, responda com algo como:
        "[NOME], na verdade isso é até positivo! Quando ainda não há um acordo
        firmado, conseguimos estruturar tudo de forma que proteja seus direitos
        desde o início — especialmente em relação à convivência com os filhos e
        ao valor da pensão. Deixar isso sem definir por muito tempo pode
        complicar bastante depois. A gente cuida disso junto."
        Depois continue coletando os dados normalmente.'
)
WHERE name = 'agente_divorcio_v1';
