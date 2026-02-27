/*
  # Add UTM tracking fields to leads table

  1. Changes
    - Add `utm_campaign` (text, nullable) - UTM campaign parameter
    - Add `utm_source` (text, nullable) - UTM source parameter
    - Add `utm_medium` (text, nullable) - UTM medium parameter
    - Add `utm_content` (text, nullable) - UTM content parameter
    - Add `campaign_id` (text, nullable) - Meta campaign ID
    - Add `adset_id` (text, nullable) - Meta adset ID
    - Add `ad_id` (text, nullable) - Meta ad ID

  2. Purpose
    These fields enable tracking of marketing attribution and campaign performance
    for leads coming from digital marketing sources like Facebook, Google Ads, etc.
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'utm_campaign'
  ) THEN
    ALTER TABLE leads ADD COLUMN utm_campaign text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'utm_source'
  ) THEN
    ALTER TABLE leads ADD COLUMN utm_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'utm_medium'
  ) THEN
    ALTER TABLE leads ADD COLUMN utm_medium text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'utm_content'
  ) THEN
    ALTER TABLE leads ADD COLUMN utm_content text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN campaign_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'adset_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN adset_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'ad_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN ad_id text;
  END IF;
END $$;