# RLS Policies — Controle de Acesso

Todas as tabelas têm Row Level Security (RLS) ativado. O role do usuário é lido de `user_profiles.role` via a função `current_user_role()`.

## Roles

| Role | Descrição |
|------|-----------|
| `admin` | Acesso total — gerencia usuários, vê tudo, cria propostas |
| `comercial` | Vê todos os leads, cria e gerencia propostas, acessa valores |
| `atendimento` | Cria/edita leads, agenda reuniões, faz triagem, não vê valores de proposta |
| `viewer` | Somente leitura — dashboard e relatórios |

## Tabelas e Políticas

### `leads`

| Operação | Quem pode |
|----------|-----------|
| SELECT | Todos os roles autenticados |
| INSERT | admin, comercial, atendimento |
| UPDATE | admin, comercial, atendimento |
| DELETE | admin |

### `lead_answers`

| Operação | Quem pode |
|----------|-----------|
| SELECT | Todos os roles autenticados |
| INSERT | admin, comercial, atendimento |
| UPDATE | admin, comercial, atendimento |
| DELETE | admin |

### `lead_activities`

| Operação | Quem pode |
|----------|-----------|
| SELECT | Todos os roles autenticados |
| INSERT | admin, comercial, atendimento |
| UPDATE | admin |
| DELETE | admin |

### `meetings`

| Operação | Quem pode |
|----------|-----------|
| SELECT | Todos os roles autenticados |
| INSERT | admin, comercial, atendimento |
| UPDATE | admin, comercial, atendimento |
| DELETE | admin |

### `proposals`

| Operação | Quem pode |
|----------|-----------|
| SELECT | admin, comercial (valores visíveis apenas para esses roles) |
| INSERT | admin, comercial |
| UPDATE | admin, comercial |
| DELETE | admin |

### `user_profiles`

| Operação | Quem pode |
|----------|-----------|
| SELECT | admin (todos) · outros roles (apenas o próprio perfil) |
| INSERT | admin |
| UPDATE | admin |
| DELETE | admin |

### `pipeline_stages`

| Operação | Quem pode |
|----------|-----------|
| SELECT | Todos os roles autenticados |
| INSERT | admin |
| UPDATE | admin |
| DELETE | admin |

### `whatsapp_instances`

| Operação | Quem pode |
|----------|-----------|
| SELECT | admin, atendimento |
| INSERT | admin |
| UPDATE | admin, atendimento |
| DELETE | admin |

## Função auxiliar

```sql
-- Retorna o role do usuário autenticado atual
SELECT current_user_role();
-- Retorna: 'admin' | 'comercial' | 'atendimento' | 'viewer' | null
```

## Notas

- Edge Functions usam `SUPABASE_SERVICE_ROLE_KEY` — bypassam RLS completamente
- O frontend usa a `ANON_KEY` — está sujeito ao RLS
- Usuários sem registro em `user_profiles` não conseguem acessar nenhuma tabela
