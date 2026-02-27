# Configuração da Automação N8N → Supabase

## Visão Geral

Este documento explica como configurar a automação completa para capturar leads do Meta Lead Ads e enviar para o Supabase automaticamente.

## Arquitetura do Fluxo

```
Meta Lead Ads → Meta Webhook → N8N → Supabase Edge Function → Banco de Dados
```

## Passo 1: Configurar Webhook no N8N

### 1.1 Criar Novo Workflow no N8N

1. Acesse seu N8N
2. Crie um novo workflow
3. Nomeie como "Meta Lead Ads → Supabase"

### 1.2 Adicionar Node "Webhook"

1. Adicione um node **Webhook** como trigger
2. Configure:
   - **HTTP Method**: `POST`
   - **Path**: `meta-lead-webhook`
   - **Authentication**: None (ou configure conforme necessário)
3. Copie a URL do webhook gerada (será algo como `https://seu-n8n.com/webhook/meta-lead-webhook`)

## Passo 2: Configurar Meta Lead Ads

### 2.1 Conectar Meta ao N8N

1. No Facebook Business Manager, acesse **Configurações de Eventos**
2. Vá em **Lead Ads**
3. Configure o webhook:
   - URL: Cole a URL do webhook do N8N
   - Eventos: Selecione `leadgen`
   - Verifique o webhook conforme solicitado pelo Meta

### 2.2 Inscrever-se nos Eventos

1. Selecione a página do Facebook
2. Inscreva-se em `leadgen` events
3. Teste enviando um lead de teste

## Passo 3: Transformar Dados no N8N

### 3.1 Adicionar Node "Set" (Mapeamento de Dados)

Após o webhook, adicione um node **Set** para mapear os dados do Meta para o formato esperado pelo Supabase:

```javascript
// Exemplo de mapeamento
{
  "full_name": "{{ $json.field_data.find(f => f.name === 'full_name')?.values[0] }}",
  "phone": "{{ $json.field_data.find(f => f.name === 'phone_number')?.values[0] }}",
  "email": "{{ $json.field_data.find(f => f.name === 'email')?.values[0] }}",
  "city": "{{ $json.field_data.find(f => f.name === 'city')?.values[0] }}",
  "state": "{{ $json.field_data.find(f => f.name === 'state')?.values[0] }}",
  "source": "meta_ads",
  "campaign": "{{ $json.campaign_name }}",
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "{{ $json.campaign_name }}",
  "utm_content": "{{ $json.ad_name }}",
  "utm_term": "",
  "campaign_id": "{{ $json.campaign_id }}",
  "adset_id": "{{ $json.adset_id }}",
  "ad_id": "{{ $json.ad_id }}",
  "form_responses": [
    {
      "question": "Quanto você gostaria de investir?",
      "answer": "{{ $json.field_data.find(f => f.name === 'investment_amount')?.values[0] }}"
    },
    {
      "question": "Qual seu objetivo?",
      "answer": "{{ $json.field_data.find(f => f.name === 'investment_goal')?.values[0] }}"
    }
  ],
  "family_income_range": "{{ $json.field_data.find(f => f.name === 'income_range')?.values[0] }}"
}
```

### 3.2 Mapeamento de Family Income Range

Se o formulário do Meta captura renda familiar, mapeie para os valores aceitos:

```javascript
// Mapeamento de valores
const incomeMap = {
  "Até R$ 5.000": "up_to_5k",
  "R$ 5.000 a R$ 10.000": "5k_to_10k",
  "R$ 10.000 a R$ 20.000": "10k_to_20k",
  "Acima de R$ 20.000": "above_20k"
};
```

## Passo 4: Enviar para Supabase

### 4.1 Adicionar Node "HTTP Request"

Adicione um node **HTTP Request** após o Set:

**Configurações:**
- **Method**: `POST`
- **URL**: `https://SEU_PROJETO.supabase.co/functions/v1/receive-lead`
- **Authentication**: None
- **Headers**:
  - `Content-Type`: `application/json`
- **Body**: Selecione "JSON" e use `{{ $json }}`

### 4.2 Testar a Integração

1. Ative o workflow no N8N
2. Envie um lead de teste pelo Meta Lead Ads
3. Verifique:
   - Se o webhook foi recebido no N8N
   - Se os dados foram transformados corretamente
   - Se o lead apareceu no Supabase

## Passo 5: Tratamento de Erros

### 5.1 Adicionar Node "If" (Validação)

Antes de enviar para o Supabase, adicione validações:

```javascript
// Validar campos obrigatórios
{{ $json.full_name && $json.phone }}
```

### 5.2 Adicionar Node "Send Email" (Notificação de Erro)

Configure notificações por email quando:
- O webhook falhar
- Dados obrigatórios estiverem faltando
- O Supabase retornar erro

## Estrutura do Payload Final

```json
{
  "full_name": "João Silva",
  "phone": "+5511999999999",
  "email": "joao@example.com",
  "city": "São Paulo",
  "state": "SP",
  "source": "meta_ads",
  "campaign": "Investimentos - Janeiro 2025",
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "investimentos_jan_2025",
  "utm_content": "video_diversificacao",
  "utm_term": "investimento seguro",
  "campaign_id": "120210000000000",
  "adset_id": "120210000000001",
  "ad_id": "120210000000002",
  "form_responses": [
    {
      "question": "Quanto você gostaria de investir?",
      "answer": "Entre R$ 100k e R$ 500k"
    },
    {
      "question": "Qual seu objetivo?",
      "answer": "Aposentadoria"
    },
    {
      "question": "Em quanto tempo pretende investir?",
      "answer": "Nos próximos 3 meses"
    }
  ],
  "family_income_range": "above_20k"
}
```

## Lógica de Score Automático

O Edge Function calcula automaticamente o score do lead baseado nas respostas:

### Score de Decisão (0-40 pontos)
- Baseado no valor de investimento mencionado
- Quanto maior o valor, maior o score

### Score de Urgência (0-30 pontos)
- Baseado no prazo mencionado
- "Imediato" ou "agora" = 30 pontos
- "Próximo mês" = 20 pontos
- "3 meses" = 15 pontos

### Score de Patrimônio (0-25 pontos)
- Baseado na faixa de renda familiar
- `above_20k` = 25 pontos
- `10k_to_20k` = 15 pontos
- `5k_to_10k` = 10 pontos

### Score de Fit (0-5 pontos)
- Baseado no objetivo mencionado
- Objetivos alinhados (aposentadoria, investimento) = 5 pontos

### Classificação Automática
- **Hot** (≥80 pontos): Lead qualificado, alta prioridade
- **Warm** (60-79 pontos): Lead promissor
- **Cold** (40-59 pontos): Lead necessita nutrição
- **Unqualified** (<40 pontos): Lead de baixa qualidade

## Campos Capturados e Armazenados

### Tabela `leads`
- Dados pessoais (nome, telefone, email, cidade, estado)
- Origem e campanha
- Scores calculados
- Classificação automática
- UTM parameters (source, medium, campaign, content, term)
- IDs do Meta (campaign_id, adset_id, ad_id)
- Faixa de renda familiar

### Tabela `lead_answers`
- Todas as respostas do formulário
- Pergunta e resposta
- Timestamp de captura

### Tabela `lead_activities`
- Registro da criação do lead
- Histórico de todas as interações

## Monitoramento

### N8N
- Monitore execuções do workflow
- Configure alertas para falhas
- Revise logs regularmente

### Supabase
- Acompanhe logs do Edge Function
- Verifique leads criados no dashboard
- Configure alertas para erros

## Troubleshooting

### Lead não aparece no Supabase
1. Verifique se o workflow está ativo no N8N
2. Confira se a URL do Edge Function está correta
3. Veja os logs do N8N para erros
4. Verifique os logs do Supabase Edge Function

### Dados incompletos
1. Revise o mapeamento no node "Set"
2. Confira os nomes dos campos no formulário do Meta
3. Teste com dados de exemplo

### Score incorreto
1. Verifique se as respostas estão sendo capturadas
2. Revise a lógica de cálculo no Edge Function
3. Ajuste as palavras-chave conforme necessário

## Próximos Passos

1. Configure notificações automáticas para leads HOT
2. Implemente enriquecimento de dados (APIs externas)
3. Configure distribuição automática de leads para vendedores
4. Adicione integração com WhatsApp para contato imediato
