-- Migration: Add loss reason categories and Next Best Action views
-- Date: 2026-03-08

-- 1. Add loss_reason_category to proposals table
ALTER TABLE proposals 
ADD COLUMN IF NOT EXISTS loss_reason_category text CHECK (loss_reason_category IN ('preco', 'concorrente', 'reconciliacao', 'timing', 'outro'));

-- 2. Create a view for Stale Strategic Leads (Next Best Action)
-- Leads classified as 'estrategico' or 'qualificado' 
-- That haven't had an activity in the last 24 hours
-- And are not in 'ganho' or 'perdido' status
CREATE OR REPLACE VIEW vw_stale_strategic_leads AS
SELECT 
  l.id as lead_id,
  l.full_name,
  l.phone,
  l.classification,
  l.status,
  l.score_total,
  l.owner_user_id,
  MAX(a.created_at) as last_activity_at,
  now() - MAX(a.created_at) as idle_time
FROM leads l
LEFT JOIN activities a ON l.id = a.lead_id
WHERE l.status NOT IN ('ganho', 'perdido')
  AND l.classification IN ('estrategico', 'qualificado')
GROUP BY l.id
HAVING MAX(a.created_at) < now() - interval '24 hours' OR MAX(a.created_at) IS NULL
ORDER BY l.score_total DESC, last_activity_at ASC;

-- 3. Add comment to explain the pilar weights if they need to be dynamic in the future
COMMENT ON FUNCTION calculate_lead_score IS 'Calculates lead score based on Decision (40), Urgency (30), Assets (25), and Fit (5).';
