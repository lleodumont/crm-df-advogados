-- Frases rápidas para o chat WhatsApp
create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  shortcut text not null,        -- ex: "oi", "horario", "docs"
  message text not null,         -- texto completo da frase
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Ordenar por shortcut
create index if not exists quick_replies_shortcut_idx on public.quick_replies (shortcut);

-- RLS: todos os usuários autenticados podem ler e escrever
alter table public.quick_replies enable row level security;

create policy "authenticated can read quick_replies"
  on public.quick_replies for select
  to authenticated using (true);

create policy "authenticated can insert quick_replies"
  on public.quick_replies for insert
  to authenticated with check (true);

create policy "authenticated can update quick_replies"
  on public.quick_replies for update
  to authenticated using (true);

create policy "authenticated can delete quick_replies"
  on public.quick_replies for delete
  to authenticated using (true);

-- Frases de exemplo
insert into public.quick_replies (shortcut, message) values
  ('oi', 'Olá! Tudo bem? Sou da equipe DF Advogados e estou aqui para ajudar você com sua consulta sobre divórcio. 😊'),
  ('horario', 'Nosso atendimento é de segunda a sexta, das 9h às 18h. Posso agendar uma conversa com um dos nossos especialistas?'),
  ('docs', 'Para darmos andamento ao seu caso, precisaremos dos seguintes documentos: RG/CPF de ambos os cônjuges, certidão de casamento, documentação dos bens e, se houver filhos menores, certidão de nascimento deles.'),
  ('consulta', 'Posso agendar uma consulta gratuita de 30 minutos com um dos nossos advogados especialistas em divórcio. Qual dia e horário seria melhor para você?'),
  ('aguarda', 'Estou verificando as informações do seu caso com a nossa equipe. Aguarde um momento, por favor!');
