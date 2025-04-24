-- Script para recriar a view referral_counts
-- Use este script no banco de dados de produção (NEON)

-- Passo 1: Remover a view se existir (mesmo que você já tenha removido, é bom garantir)
DROP VIEW IF EXISTS referral_counts;

-- Passo 2: Criar a view compatível com o tipo TEXT da coluna referred_by
CREATE OR REPLACE VIEW referral_counts AS
SELECT 
  u.id AS user_id,
  COUNT(CASE WHEN r.referred_by = u.referral_code THEN 1 ELSE NULL END) AS level1_count,
  0 AS level2_count,
  0 AS level3_count,
  SUM(CASE WHEN r.referred_by = u.referral_code AND r.has_product = true THEN 1 ELSE 0 END) AS level1_active,
  0 AS level2_active,
  0 AS level3_active
FROM users u
LEFT JOIN users r ON r.referred_by = u.referral_code
GROUP BY u.id;
