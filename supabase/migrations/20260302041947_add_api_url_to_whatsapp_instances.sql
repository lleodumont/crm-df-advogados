/*
  # Add api_url to whatsapp_instances table

  1. Changes
    - Add api_url column to whatsapp_instances table
    - This column stores the UazAPI base URL for each instance
    
  2. Notes
    - Column is nullable to support existing instances
    - Instances created through the UI will have this field populated
*/

-- Add api_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_instances' AND column_name = 'api_url'
  ) THEN
    ALTER TABLE whatsapp_instances ADD COLUMN api_url TEXT;
  END IF;
END $$;