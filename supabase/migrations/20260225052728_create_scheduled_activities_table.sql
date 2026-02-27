/*
  # Create Scheduled Activities Table

  1. New Tables
    - `scheduled_activities`
      - `id` (uuid, primary key) - Unique identifier
      - `lead_id` (uuid, foreign key) - Reference to the lead
      - `user_id` (uuid, foreign key) - User responsible
      - `activity_type` (text) - Type: meeting, call, task, email, follow_up
      - `title` (text) - Title/summary
      - `description` (text, nullable) - Details
      - `scheduled_at` (timestamptz) - When scheduled
      - `completed_at` (timestamptz, nullable) - When completed
      - `status` (text) - scheduled, completed, cancelled, overdue
      - `priority` (text) - low, medium, high, urgent
      - `location` (text, nullable) - Location or link
      - `duration_minutes` (integer, nullable) - Duration
      - `notes` (text, nullable) - Notes
      - `created_at` (timestamptz) - Created
      - `updated_at` (timestamptz) - Updated

  2. Security
    - Enable RLS
    - Policies for authenticated users

  3. Indexes
    - Performance indexes on key fields
*/

CREATE TABLE IF NOT EXISTS scheduled_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('meeting', 'call', 'task', 'email', 'follow_up')),
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'overdue')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  location text,
  duration_minutes integer CHECK (duration_minutes > 0),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE scheduled_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduled activities"
  ON scheduled_activities FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view scheduled activities for leads they own"
  ON scheduled_activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = scheduled_activities.lead_id
      AND leads.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create scheduled activities"
  ON scheduled_activities FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own scheduled activities"
  ON scheduled_activities FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own scheduled activities"
  ON scheduled_activities FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_scheduled_activities_lead_id ON scheduled_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_activities_user_id ON scheduled_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_activities_scheduled_at ON scheduled_activities(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_activities_status ON scheduled_activities(status);

CREATE OR REPLACE FUNCTION update_scheduled_activities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scheduled_activities_updated_at
  BEFORE UPDATE ON scheduled_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_activities_updated_at();