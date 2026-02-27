/*
  # DF CRM – Divórcios Schema

  ## Overview
  Complete CRM system for family law office specializing in divorce cases.
  Captures leads from Meta Ads, calculates lead scoring, manages sales pipeline,
  and tracks key metrics and lead time.

  ## New Tables

  1. **leads**
     - Core lead/client table with contact info, source tracking, status
     - Scoring fields (decision, urgency, assets, fit, total)
     - Classification (morno/qualificado/estrategico)
     - Milestone timestamps for lead time tracking
     - Deal closure tracking

  2. **lead_answers**
     - Stores form responses and human validation answers
     - Links to leads via lead_id
     - Tracks source (meta_form vs triagem_humana)

  3. **activities**
     - Complete timeline/audit log for all lead interactions
     - Tracks messages, calls, notes, status changes

  4. **meetings**
     - Scheduled and held meetings tracking
     - Status management (scheduled/held/no_show/canceled)
     - Links first meeting to lead milestone

  5. **proposals**
     - Deal proposals with value and terms
     - Tracks presentation, closure, and loss reasons
     - Updates lead closure milestones

  6. **user_profiles**
     - User roles and permissions
     - Links to Supabase auth.users

  ## Security
  - RLS enabled on all tables
  - Role-based access control (admin, atendimento, comercial, viewer)
  - Users can only access leads assigned to them or public leads

  ## Triggers
  - Auto-update first_meeting_scheduled_at on meeting creation
  - Auto-update proposal_presented_at on proposal creation
  - Auto-update closed_at and deal status on proposal closure
  - Maintain status consistency across related tables
*/

-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'atendimento', 'comercial', 'viewer')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  city text,
  state text,
  source text NOT NULL DEFAULT 'meta_form',
  campaign text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  status text DEFAULT 'novo' CHECK (status IN ('novo', 'triagem', 'qualificado', 'agendado', 'compareceu', 'proposta_enviada', 'ganho', 'perdido', 'maturacao')),
  owner_user_id uuid REFERENCES user_profiles(id),
  notes text,
  
  -- Scoring fields
  score_total int DEFAULT 0,
  score_decision int DEFAULT 0,
  score_urgency int DEFAULT 0,
  score_assets int DEFAULT 0,
  score_fit int DEFAULT 0,
  classification text DEFAULT 'morno' CHECK (classification IN ('morno', 'qualificado', 'estrategico')),
  
  -- Milestone timestamps for lead time tracking
  first_meeting_scheduled_at timestamptz,
  proposal_presented_at timestamptz,
  closed_at timestamptz,
  closed_status text CHECK (closed_status IN ('won', 'lost')),
  deal_value numeric
);

-- Create lead_answers table
CREATE TABLE IF NOT EXISTS lead_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  answer_value text NOT NULL,
  source text NOT NULL DEFAULT 'meta_form' CHECK (source IN ('meta_form', 'triagem_humana')),
  created_at timestamptz DEFAULT now()
);

-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('msg_sent', 'msg_received', 'call', 'audio', 'followup', 'note', 'status_change')),
  channel text CHECK (channel IN ('whatsapp', 'phone', 'email', 'internal')),
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES user_profiles(id),
  content text NOT NULL
);

-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  held_at timestamptz,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'held', 'no_show', 'rescheduled', 'canceled')),
  responsible_user_id uuid REFERENCES user_profiles(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  presented_at timestamptz NOT NULL,
  value numeric NOT NULL,
  payment_terms text,
  status text DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  closed_at timestamptz,
  loss_reason text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_classification ON leads(classification);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_score_total ON leads(score_total DESC);
CREATE INDEX IF NOT EXISTS idx_lead_answers_lead_id ON lead_answers(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_lead_id ON meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_at ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_proposals_lead_id ON proposals(lead_id);

-- Trigger: Update first_meeting_scheduled_at when meeting is created
CREATE OR REPLACE FUNCTION update_first_meeting_scheduled()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'scheduled' THEN
    UPDATE leads
    SET 
      first_meeting_scheduled_at = COALESCE(first_meeting_scheduled_at, NEW.scheduled_at),
      status = CASE 
        WHEN status IN ('novo', 'triagem', 'qualificado') THEN 'agendado'
        ELSE status
      END,
      updated_at = now()
    WHERE id = NEW.lead_id AND first_meeting_scheduled_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_first_meeting_scheduled
AFTER INSERT ON meetings
FOR EACH ROW
EXECUTE FUNCTION update_first_meeting_scheduled();

-- Trigger: Update proposal_presented_at when proposal is created
CREATE OR REPLACE FUNCTION update_proposal_presented()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE leads
  SET 
    proposal_presented_at = COALESCE(proposal_presented_at, NEW.presented_at),
    status = CASE 
      WHEN status NOT IN ('ganho', 'perdido') THEN 'proposta_enviada'
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.lead_id AND proposal_presented_at IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_proposal_presented
AFTER INSERT ON proposals
FOR EACH ROW
EXECUTE FUNCTION update_proposal_presented();

-- Trigger: Update lead closure when proposal is won/lost
CREATE OR REPLACE FUNCTION update_lead_closure()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('won', 'lost') AND OLD.status = 'open' THEN
    UPDATE proposals
    SET closed_at = COALESCE(closed_at, now())
    WHERE id = NEW.id AND closed_at IS NULL;
    
    UPDATE leads
    SET 
      closed_at = COALESCE(closed_at, now()),
      closed_status = NEW.status::text,
      deal_value = CASE WHEN NEW.status = 'won' THEN NEW.value ELSE deal_value END,
      status = CASE WHEN NEW.status = 'won' THEN 'ganho' ELSE 'perdido' END,
      updated_at = now()
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_lead_closure
AFTER UPDATE ON proposals
FOR EACH ROW
EXECUTE FUNCTION update_lead_closure();

-- Function: Calculate lead scoring
CREATE OR REPLACE FUNCTION calculate_lead_score(p_lead_id uuid)
RETURNS void AS $$
DECLARE
  v_score_decision int := 0;
  v_score_urgency int := 0;
  v_score_assets int := 0;
  v_score_fit int := 0;
  v_score_total int := 0;
  v_classification text := 'morno';
  v_answer text;
  v_answer_array text[];
BEGIN
  -- Get most recent answer for each question_key
  
  -- PILAR DECISÃO (0-40)
  -- stage
  SELECT answer_value INTO v_answer
  FROM lead_answers
  WHERE lead_id = p_lead_id AND question_key = 'stage'
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_answer = 'decidi_estruturar' THEN v_score_decision := v_score_decision + 25;
  ELSIF v_answer = 'quase_decidido' THEN v_score_decision := v_score_decision + 15;
  ELSIF v_answer = 'avaliando' THEN v_score_decision := v_score_decision + 5;
  END IF;
  
  -- timeline_start
  SELECT answer_value INTO v_answer
  FROM lead_answers
  WHERE lead_id = p_lead_id AND question_key = 'timeline_start'
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_answer = 'ate_7_dias' THEN v_score_decision := v_score_decision + 10;
  ELSIF v_answer = 'ate_30_dias' THEN v_score_decision := v_score_decision + 5;
  ELSIF v_answer = 'sem_prazo' THEN v_score_decision := v_score_decision + 0;
  END IF;
  
  -- authority
  SELECT answer_value INTO v_answer
  FROM lead_answers
  WHERE lead_id = p_lead_id AND question_key = 'authority'
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_answer = 'decido_sozinho' THEN v_score_decision := v_score_decision + 5;
  ELSIF v_answer = 'preciso_alinhar' THEN v_score_decision := v_score_decision + 3;
  ELSIF v_answer = 'nao_sei' THEN v_score_decision := v_score_decision + 1;
  END IF;
  
  -- Cap at 40
  v_score_decision := LEAST(v_score_decision, 40);
  
  -- PILAR URGÊNCIA/RISCO (0-30)
  -- urgency_now (multiple selection)
  SELECT answer_value INTO v_answer
  FROM lead_answers
  WHERE lead_id = p_lead_id AND question_key = 'urgency_now'
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_answer IS NOT NULL THEN
    v_answer_array := string_to_array(v_answer, ',');
    FOREACH v_answer IN ARRAY v_answer_array LOOP
      IF trim(v_answer) = 'ja_existe_processo' THEN v_score_urgency := v_score_urgency + 15;
      ELSIF trim(v_answer) = 'ameaca_processo' THEN v_score_urgency := v_score_urgency + 10;
      ELSIF trim(v_answer) = 'conflito_bens' THEN v_score_urgency := v_score_urgency + 8;
      ELSIF trim(v_answer) = 'disputa_filhos' THEN v_score_urgency := v_score_urgency + 8;
      ELSIF trim(v_answer) = 'organizar_com_calma' THEN v_score_urgency := v_score_urgency + 0;
      END IF;
    END LOOP;
  END IF;
  
  -- risk_15d
  SELECT answer_value INTO v_answer
  FROM lead_answers
  WHERE lead_id = p_lead_id AND question_key = 'risk_15d'
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_answer = 'sim' THEN v_score_urgency := v_score_urgency + 10;
  ELSIF v_answer = 'talvez' THEN v_score_urgency := v_score_urgency + 5;
  ELSIF v_answer = 'nao' THEN v_score_urgency := v_score_urgency + 0;
  END IF;
  
  -- Cap at 30
  v_score_urgency := LEAST(v_score_urgency, 30);
  
  -- PILAR PATRIMÔNIO/COMPLEXIDADE (0-25)
  -- assets_types (multiple selection)
  SELECT answer_value INTO v_answer
  FROM lead_answers
  WHERE lead_id = p_lead_id AND question_key = 'assets_types'
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_answer IS NOT NULL THEN
    v_answer_array := string_to_array(v_answer, ',');
    FOREACH v_answer IN ARRAY v_answer_array LOOP
      IF trim(v_answer) = 'empresa_cotas' THEN v_score_assets := v_score_assets + 10;
      ELSIF trim(v_answer) = 'imovel_financiado' THEN v_score_assets := v_score_assets + 7;
      ELSIF trim(v_answer) = 'imovel_quitado' THEN v_score_assets := v_score_assets + 5;
      ELSIF trim(v_answer) = 'investimentos' THEN v_score_assets := v_score_assets + 5;
      ELSIF trim(v_answer) = 'veiculos' THEN v_score_assets := v_score_assets + 3;
      ELSIF trim(v_answer) = 'sem_bens' THEN v_score_assets := v_score_assets + 0;
      END IF;
    END LOOP;
  END IF;
  
  -- assets_range
  SELECT answer_value INTO v_answer
  FROM lead_answers
  WHERE lead_id = p_lead_id AND question_key = 'assets_range'
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_answer = 'acima_1m' THEN v_score_assets := v_score_assets + 10;
  ELSIF v_answer = '500k_1m' THEN v_score_assets := v_score_assets + 7;
  ELSIF v_answer = '200k_500k' THEN v_score_assets := v_score_assets + 4;
  ELSIF v_answer = 'ate_200k' THEN v_score_assets := v_score_assets + 2;
  ELSIF v_answer = 'prefiro_nao_informar' THEN v_score_assets := v_score_assets + 3;
  END IF;
  
  -- Cap at 25
  v_score_assets := LEAST(v_score_assets, 25);
  
  -- PILAR FIT OFERTA (0-5)
  SELECT answer_value INTO v_answer
  FROM lead_answers
  WHERE lead_id = p_lead_id AND question_key = 'offer_fit'
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_answer = 'conducao_completa' THEN v_score_fit := 5;
  ELSIF v_answer = 'orientacao_pontual' THEN v_score_fit := 0;
  ELSIF v_answer = 'nao_sei' THEN v_score_fit := 2;
  END IF;
  
  -- Calculate total (max 100)
  v_score_total := v_score_decision + v_score_urgency + v_score_assets + v_score_fit;
  
  -- Determine classification
  IF v_score_total >= 70 THEN
    v_classification := 'estrategico';
  ELSIF v_score_total >= 40 THEN
    v_classification := 'qualificado';
  ELSE
    v_classification := 'morno';
  END IF;
  
  -- Update lead
  UPDATE leads
  SET 
    score_decision = v_score_decision,
    score_urgency = v_score_urgency,
    score_assets = v_score_assets,
    score_fit = v_score_fit,
    score_total = v_score_total,
    classification = v_classification,
    updated_at = now()
  WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Recalculate score when lead_answers changes
CREATE OR REPLACE FUNCTION trigger_recalculate_score()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_lead_score(NEW.lead_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_lead_answers_score
AFTER INSERT OR UPDATE ON lead_answers
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_score();

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage all profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for leads
CREATE POLICY "Users can view leads they own or unassigned"
  ON leads FOR SELECT
  TO authenticated
  USING (
    owner_user_id = auth.uid() 
    OR owner_user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  );

CREATE POLICY "Atendimento and above can create leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'atendimento', 'comercial')
    )
  );

CREATE POLICY "Users can update leads they own"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  );

CREATE POLICY "Admins can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for lead_answers
CREATE POLICY "Users can view answers for accessible leads"
  ON lead_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_answers.lead_id
      AND (
        leads.owner_user_id = auth.uid()
        OR leads.owner_user_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND role IN ('admin', 'comercial')
        )
      )
    )
  );

CREATE POLICY "Atendimento and above can create answers"
  ON lead_answers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'atendimento', 'comercial')
    )
  );

-- RLS Policies for activities
CREATE POLICY "Users can view activities for accessible leads"
  ON activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = activities.lead_id
      AND (
        leads.owner_user_id = auth.uid()
        OR leads.owner_user_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND role IN ('admin', 'comercial')
        )
      )
    )
  );

CREATE POLICY "Atendimento and above can create activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'atendimento', 'comercial')
    )
  );

-- RLS Policies for meetings
CREATE POLICY "Users can view meetings for accessible leads"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = meetings.lead_id
      AND (
        leads.owner_user_id = auth.uid()
        OR leads.owner_user_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND role IN ('admin', 'comercial')
        )
      )
    )
  );

CREATE POLICY "Atendimento and above can manage meetings"
  ON meetings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'atendimento', 'comercial')
    )
  );

-- RLS Policies for proposals
CREATE POLICY "Comercial and admin can view all proposals"
  ON proposals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  );

CREATE POLICY "Comercial and admin can manage proposals"
  ON proposals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  );
