/*
  # WhatsApp Integration with UazAPI

  ## Overview
  Complete WhatsApp integration using UazAPI service. This migration creates the infrastructure
  to manage multiple WhatsApp instances, store message history, and track connection status.

  ## New Tables

  ### `whatsapp_instances`
  Stores WhatsApp instance configurations and connection status.
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Friendly name for the instance
  - `instance_id` (text, unique) - UazAPI instance identifier
  - `phone_number` (text) - Connected phone number
  - `status` (text) - Connection status: 'disconnected', 'connecting', 'connected', 'qrcode'
  - `qr_code` (text, nullable) - Base64 QR code for connection
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `created_by` (uuid) - User who created the instance

  ### `whatsapp_messages`
  Stores all WhatsApp messages (sent and received).
  - `id` (uuid, primary key) - Unique identifier
  - `instance_id` (uuid) - Reference to whatsapp_instances
  - `lead_id` (uuid, nullable) - Reference to leads table
  - `phone_number` (text) - Contact phone number
  - `message_type` (text) - Type: 'text', 'image', 'audio', 'video', 'document'
  - `content` (text) - Message content
  - `media_url` (text, nullable) - URL for media files
  - `direction` (text) - Message direction: 'inbound', 'outbound'
  - `status` (text) - Status: 'pending', 'sent', 'delivered', 'read', 'failed'
  - `external_id` (text, nullable) - UazAPI message ID
  - `created_at` (timestamptz) - Creation timestamp
  - `sent_by` (uuid, nullable) - User who sent the message

  ## Security
  - Enable RLS on both tables
  - Policies for authenticated users to:
    - View all instances and messages
    - Create new instances (admins and managers only)
    - Send messages (all authenticated users)
    - Update instance status (system only via service role)

  ## Indexes
  - Index on whatsapp_messages.lead_id for fast lead-based queries
  - Index on whatsapp_messages.phone_number for contact lookup
  - Index on whatsapp_messages.created_at for chronological ordering
*/

-- Create whatsapp_instances table
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  instance_id text UNIQUE NOT NULL,
  phone_number text,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'qrcode')),
  qr_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create whatsapp_messages table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document')),
  content text NOT NULL,
  media_url text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  external_id text,
  created_at timestamptz DEFAULT now(),
  sent_by uuid REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead_id ON whatsapp_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_number ON whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_instance_id ON whatsapp_messages(instance_id);

-- Enable RLS
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Policies for whatsapp_instances

-- All authenticated users can view instances
CREATE POLICY "Users can view all WhatsApp instances"
  ON whatsapp_instances FOR SELECT
  TO authenticated
  USING (true);

-- Only admins and managers can create instances
CREATE POLICY "Admins and managers can create WhatsApp instances"
  ON whatsapp_instances FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'manager')
    )
  );

-- Only admins and managers can update instances
CREATE POLICY "Admins and managers can update WhatsApp instances"
  ON whatsapp_instances FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'manager')
    )
  );

-- Only admins can delete instances
CREATE POLICY "Admins can delete WhatsApp instances"
  ON whatsapp_instances FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policies for whatsapp_messages

-- All authenticated users can view all messages
CREATE POLICY "Users can view all WhatsApp messages"
  ON whatsapp_messages FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can send messages
CREATE POLICY "Users can send WhatsApp messages"
  ON whatsapp_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sent_by OR sent_by IS NULL);

-- Users can update message status (for delivery receipts)
CREATE POLICY "Users can update message status"
  ON whatsapp_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_whatsapp_instance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_instance_updated_at();