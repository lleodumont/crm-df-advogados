/*
  # Add Tags and Custom Stages System

  ## New Tables

  ### `tags`
  - `id` (uuid, primary key) - Unique identifier for each tag
  - `name` (text, not null) - Tag name
  - `color` (text, not null) - Hex color code for the tag
  - `created_at` (timestamptz) - When the tag was created
  - `created_by` (uuid, foreign key to auth.users) - User who created the tag

  ### `lead_tags`
  - `lead_id` (uuid, foreign key to leads) - Reference to lead
  - `tag_id` (uuid, foreign key to tags) - Reference to tag
  - `created_at` (timestamptz) - When the tag was assigned
  - `created_by` (uuid, foreign key to auth.users) - User who assigned the tag
  - Primary key: (lead_id, tag_id)

  ### `pipeline_stages`
  - `id` (uuid, primary key) - Unique identifier for each stage
  - `name` (text, not null) - Stage name
  - `stage_key` (text, not null, unique) - Unique key for the stage
  - `color` (text, not null) - Hex color code for the stage
  - `order_index` (integer, not null) - Order in which stages appear
  - `is_default` (boolean, default false) - Whether this is a default system stage
  - `created_at` (timestamptz) - When the stage was created

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to manage tags
  - Add policies for viewing and assigning tags to leads
  - Add policies for managing pipeline stages (admin only for stages)
*/

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create lead_tags junction table
CREATE TABLE IF NOT EXISTS lead_tags (
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (lead_id, tag_id)
);

-- Create pipeline_stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  stage_key text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6B7280',
  order_index integer NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Insert default stages
INSERT INTO pipeline_stages (name, stage_key, color, order_index, is_default)
VALUES
  ('Novo lead', 'new', '#3B82F6', 1, true),
  ('Qualificado', 'qualified', '#10B981', 2, true),
  ('Reunião Agendada', 'meeting_scheduled', '#F59E0B', 3, true),
  ('Compareceu', 'meeting_held', '#8B5CF6', 4, true),
  ('Proposta Enviada', 'proposal_sent', '#EC4899', 5, true),
  ('Negociação', 'negotiation', '#F97316', 6, true),
  ('Ganho', 'won', '#22C55E', 7, true),
  ('Perdido', 'lost', '#EF4444', 8, true)
ON CONFLICT (stage_key) DO NOTHING;

-- Enable RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Tags policies
CREATE POLICY "Authenticated users can view tags"
  ON tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own tags"
  ON tags FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own tags"
  ON tags FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Lead tags policies
CREATE POLICY "Authenticated users can view lead tags"
  ON lead_tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can assign tags to leads"
  ON lead_tags FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can remove tags from leads"
  ON lead_tags FOR DELETE
  TO authenticated
  USING (true);

-- Pipeline stages policies
CREATE POLICY "Authenticated users can view pipeline stages"
  ON pipeline_stages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can create pipeline stages"
  ON pipeline_stages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update pipeline stages"
  ON pipeline_stages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete non-default pipeline stages"
  ON pipeline_stages FOR DELETE
  TO authenticated
  USING (
    is_default = false
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_lead_tags_lead_id ON lead_tags(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tags_tag_id ON lead_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_order ON pipeline_stages(order_index);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_stage_key ON pipeline_stages(stage_key);
