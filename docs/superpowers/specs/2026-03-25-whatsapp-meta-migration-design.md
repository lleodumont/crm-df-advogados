# Design: Migração WhatsApp — Uazapi → Meta Cloud API

**Data:** 2026-03-25
**Abordagem:** A — Substituição direta (mesmos nomes de função, mesmo contrato de chamada)
**Status:** Aprovado

---

## Contexto

O CRM usa três Supabase Edge Functions para integração com WhatsApp via Uazapi (API não oficial). A migração substitui o provedor interno pela API oficial do WhatsApp Business (Meta Cloud API), sem alterar contratos do frontend.

---

## O que muda

| Componente | Antes (Uazapi) | Depois (Meta Cloud API) |
|---|---|---|
| Autenticação | `UAZAPI_TOKEN` por instância na tabela `whatsapp_instances` | `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN` como secrets globais |
| Conexão | QR code escaneado, instância salva no banco | Número fixo registrado na Meta, sem estado no banco |
| Envio de texto | `POST {api_url}/send/text` | `POST https://graph.facebook.com/v22.0/{phone_id}/messages` |
| Envio de mídia | Base64 ou URL direto | Upload prévio via `POST /media` → usa `media_id` |
| Webhook entrada | Payload Uazapi (múltiplos formatos) | Payload Meta normalizado + verificação GET com `hub.challenge` |
| Grupos | Suportado via JID | Não suportado (não utilizado no CRM) |

### Variáveis de ambiente

**Removidas:**
- `UAZAPI_BASE_URL`
- `UAZAPI_TOKEN`
- `UAZAPI_ADMIN_TOKEN`

**Adicionadas:**
- `WHATSAPP_PHONE_NUMBER_ID` — ID do número registrado no Meta
- `WHATSAPP_ACCESS_TOKEN` — System User token (longa duração; pode ser revogado manualmente)
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — string secreta para verificação do webhook
- `WHATSAPP_WEBHOOK_SECRET` — segredo HMAC para validar assinatura `X-Hub-Signature-256` nos POSTs do webhook

---

## Edge Functions

### `whatsapp-manager` (simplificada)

Remove toda a lógica de instância e QR code. Expõe uma única rota:

**`GET /whatsapp-manager/status`**

Chama `GET https://graph.facebook.com/v22.0/{WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name` e retorna:

```json
// Sucesso (200)
{ "status": "connected", "phone": "+5511999999999", "name": "DF Advogados" }

// Token inválido / expirado (200 com status de erro)
{ "status": "error", "error": "invalid_token" }
```

A tabela `whatsapp_instances` é mantida no banco sem alteração (dados históricos). Nenhuma função nova lê ou escreve nela.

---

### `whatsapp-send` (modificada)

O campo `instance_id` no body é **opcional** e ignorado internamente. O frontend pode omiti-lo sem receber erro.

**Formato do número `to`:** a função normaliza para E.164 sem `+` (ex: `5511999999999`), removendo `+`, espaços, traços e sufixo `@s.whatsapp.net` caso presentes.

**Envio de texto:**
```
Request:  { instance_id?, to, text }
→ POST graph.facebook.com/v22.0/{phone_id}/messages
  { messaging_product: "whatsapp", to: "5511...", type: "text", text: { body } }

Sucesso:  { message_id, status: "sent" }
Erro:     { error: "outside_window" | "invalid_number" | "upload_failed" | "unknown" }
HTTP:     200 em sucesso, 422 em erro de negócio, 500 em erro inesperado
```

**Envio de mídia:**

O campo `file` é aceito como base64 puro ou data URI (`data:image/jpeg;base64,...`). A função extrai o binário antes do upload.

```
Request:  { instance_id?, to, mediaType, file (base64 ou data URI), mimetype, docName? }

Etapa 1 → POST graph.facebook.com/v22.0/{phone_id}/media
          multipart/form-data: { file: <binário>, type: <mimetype> }
          Retorna: { id: media_id }

Etapa 2 → POST graph.facebook.com/v22.0/{phone_id}/messages
          {
            type: "image" | "video" | "audio" | "document",
            [type]: {
              id: media_id,
              filename: docName   // apenas para type=document
            }
          }
```

Tipos suportados: `image`, `video`, `audio`, `document`.

Limites de tamanho validados antes do upload (retorna 422 se exceder):
- image: 5 MB
- video: 16 MB
- audio: 16 MB
- document: 100 MB

Salvamento em `whatsapp_messages` com `direction: "outbound"` não muda. Em caso de falha, salva com `status: "failed"` e preenche a coluna `error` (já existente na tabela) com o código de erro.

---

### `whatsapp-webhook` (modificada)

**Verificação de assinatura (POST):**
Todo POST deve ter o header `X-Hub-Signature-256: sha256=<hmac>`. A função valida o HMAC usando `WHATSAPP_WEBHOOK_SECRET`. Requisições sem assinatura válida retornam 401.

**Handler GET — verificação inicial:**
```
GET /whatsapp-webhook
  ?hub.mode=subscribe
  &hub.verify_token={WHATSAPP_WEBHOOK_VERIFY_TOKEN}
  &hub.challenge=XXXX
→ 200 "XXXX"  (texto puro)
→ 403 se hub.verify_token não bater
```

**Handler POST — payload Meta:**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{ "id": "wamid.XXX", "from": "5511...", "type": "text", "text": { "body": "..." } }],
        "contacts": [{ "profile": { "name": "..." } }],
        "statuses": [{ "id": "wamid.XXX", "status": "delivered" | "read" | "failed" }]
      }
    }]
  }]
}
```

**Idempotência:** o campo `messages[].id` (wamid) é usado como `external_id` no upsert de `whatsapp_messages`. Reentregas da Meta não criam duplicatas.

**Status updates** (`statuses[]`): quando presente, atualiza `whatsapp_messages.status` para `"delivered"` ou `"read"` pelo `external_id`. Ignorado silenciosamente se `external_id` não existir no banco.

**Mídia inbound:**
1. `GET graph.facebook.com/v22.0/{media_id}` → obtém URL temporária (válida por ~5 min)
2. Download com timeout de 10s
3. Upload para Supabase Storage (`whatsapp-media`)
4. Se download falhar: salva mensagem com `media_url: null` e `status: "media_failed"` — não bloqueia a resposta 200 para a Meta

**Tipos de mensagem inbound:** `text`, `image`, `video`, `audio`, `voice` (ambos `audio` e `voice` são salvos como tipo `audio`), `document`.

A função retorna 200 imediatamente ao receber o webhook. Operações de banco e storage são executadas de forma que a resposta não seja bloqueada além de 15s.

---

## Schema do banco

A tabela `whatsapp_messages` já possui a coluna `error` (tipo text, nullable). Nenhuma migration é necessária.

A tabela `whatsapp_instances` é mantida sem alteração.

---

## Tratamento de erros (whatsapp-send)

| Código Meta | Significado | `error` salvo | HTTP retornado |
|---|---|---|---|
| `131047` | Fora da janela de 24h | `outside_window` | 422 |
| `131026` | Número inválido | `invalid_number` | 422 |
| Falha no upload de mídia | Etapa 1 falhou | `upload_failed` | 422 |
| Outros | Erro inesperado | `unknown` | 500 |

Templates de mensagem (para uso fora da janela) ficam para uma segunda fase.

---

## Critérios de aceitação

- [ ] `GET /whatsapp-manager/status` retorna `{ status: "connected", phone, name }` com token válido
- [ ] `GET /whatsapp-manager/status` retorna `{ status: "error", error: "invalid_token" }` com token inválido
- [ ] Envio de texto cria registro em `whatsapp_messages` com `status: "sent"`
- [ ] Envio fora da janela de 24h cria registro com `status: "failed"`, `error: "outside_window"` e retorna 422
- [ ] Envio de imagem faz upload e entrega via `media_id`
- [ ] `GET /whatsapp-webhook` com token correto responde com `hub.challenge`
- [ ] `GET /whatsapp-webhook` com token errado responde 403
- [ ] `POST /whatsapp-webhook` sem assinatura válida responde 401
- [ ] Mensagem de texto inbound é salva em `whatsapp_messages` com lead correto
- [ ] Segunda entrega do mesmo `wamid` não cria duplicata
- [ ] Status update `delivered` atualiza `whatsapp_messages.status`
- [ ] Mídia inbound é salva no bucket `whatsapp-media`
- [ ] Falha no download de mídia inbound não impede o 200 para a Meta

---

## Sequência de deploy

1. Adicionar secrets no Supabase: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_WEBHOOK_SECRET`
2. Deploy de `whatsapp-webhook` (habilita o handler GET para verificação)
3. Configurar webhook no painel Meta (Meta faz o GET de verificação)
4. Deploy de `whatsapp-send`
5. Deploy de `whatsapp-manager`
6. Remover secrets antigos: `UAZAPI_BASE_URL`, `UAZAPI_TOKEN`, `UAZAPI_ADMIN_TOKEN`
7. Verificar `GET /whatsapp-manager/status` retorna `connected`

**Rollback:** os secrets Uazapi podem ser mantidos durante a transição. Para reverter, basta fazer deploy das versões anteriores das funções.

---

## O que não muda

- Frontend (contratos preservados)
- Schema do banco de dados
- Bucket de storage `whatsapp-media`
- Lógica de match de lead por telefone
- Salvamento de mensagens em `whatsapp_messages`
