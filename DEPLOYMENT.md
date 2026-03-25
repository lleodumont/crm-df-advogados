# Deploy

## Stack

- **Frontend**: React + Vite → hospedado na Hostinger (ou Vercel/Netlify)
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + RLS)
- **WhatsApp**: UazAPI

---

## Build de Produção

```bash
npm run build
```

Gera a pasta `dist/` pronta para upload.

---

## Hostinger (atual)

1. Faça o build: `npm run build`
2. Acesse o painel da Hostinger → File Manager
3. Faça upload do conteúdo de `dist/` para `public_html/`
4. Certifique-se de que existe um arquivo `.htaccess` para redirecionar todas as rotas para `index.html` (SPA):

```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

---

## Vercel (alternativa)

1. Conecte o repositório no Vercel
2. Framework preset: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`
5. Adicione as variáveis de ambiente (veja `.env.example`)

---

## Netlify (alternativa)

1. Conecte o repositório no Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Adicione um arquivo `public/_redirects`:

```
/*  /index.html  200
```

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha os valores:

```bash
cp .env.example .env
```

| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase |
| `VITE_UAZAPI_URL` | URL da instância UazAPI |
| `VITE_UAZAPI_TOKEN` | Token de autenticação UazAPI |
| `VITE_WHATSAPP_INSTANCE` | Nome da instância WhatsApp |

---

## Supabase — Migrations

Para aplicar migrations pendentes no banco:

```bash
# Login
supabase login

# Linkar projeto
supabase link --project-ref gknevfldmvtnjluotdmf

# Aplicar migrations
supabase db push
```

---

## Edge Functions

Para fazer deploy das Edge Functions:

```bash
# Todas as funções
supabase functions deploy

# Função específica
supabase functions deploy receive-lead
```

---

## Primeiro Deploy (ambiente novo)

1. Crie um projeto no Supabase
2. Copie as credenciais para `.env`
3. Execute as migrations: `supabase db push`
4. Faça deploy das Edge Functions: `supabase functions deploy`
5. Crie o primeiro usuário admin via SQL:

```sql
-- Após criar o usuário no Supabase Auth, execute:
INSERT INTO user_profiles (id, email, full_name, role, active)
VALUES ('uuid-do-auth-user', 'admin@escritorio.com', 'Nome Admin', 'admin', true);
```

Ou use o arquivo `CREATE_ADMIN_USER.sql` na raiz do projeto.

6. Faça build do frontend e hospede
7. Configure o webhook do Meta Ads (veja `INTEGRACAO_META.md`)
