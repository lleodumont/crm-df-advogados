-- ============================================
-- INSTRUÇÕES PARA CRIAR USUÁRIO ADMIN
-- ============================================
--
-- PASSO 1: Criar usuário no Supabase Authentication
-- -------------------------------------------------
-- Acesse: https://asnenjgwavrdmwjrbzec.supabase.co/project/_/auth/users
--
-- Clique em "Add User" → "Create new user"
-- Preencha:
--   Email: admin@dfcrm.com
--   Password: Admin123!@#
--   Auto Confirm User: MARCADO (checked)
--
-- Clique em "Create User"
-- COPIE o UUID do usuário criado (ex: 123e4567-e89b-12d3-a456-426614174000)
--
-- PASSO 2: Criar perfil de usuário no CRM
-- -------------------------------------------------
-- Cole o UUID copiado na linha abaixo e execute este SQL no SQL Editor:

INSERT INTO user_profiles (id, email, full_name, role, active)
VALUES (
  'b7bb41cb-cdc1-4a2f-9551-aac7d93a171e',  -- <<<< COLE O UUID AQUI
  'admin@dfcrm.com',
  'Administrador',
  'admin',
  true
);

-- PASSO 3: Verificar se foi criado
-- -------------------------------------------------
SELECT * FROM user_profiles WHERE email = 'admin@dfcrm.com';

-- ============================================
-- CREDENCIAIS DE LOGIN
-- ============================================
-- Email: admin@dfcrm.com
-- Senha: Admin123!@#
-- ============================================
