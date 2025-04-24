-- Script para corrigir a coluna referred_by no banco de dados NEON
-- Altera o tipo de INTEGER para TEXT

-- Verificar o tipo atual da coluna
DO $$
DECLARE
   column_type TEXT;
BEGIN
   SELECT data_type INTO column_type
   FROM information_schema.columns 
   WHERE table_name = 'users' 
   AND column_name = 'referred_by';
   
   RAISE NOTICE 'Tipo atual da coluna referred_by: %', column_type;
   
   -- Se não for TEXT ou VARCHAR, alterar
   IF column_type IS NOT NULL AND column_type NOT IN ('text', 'character varying') THEN
      RAISE NOTICE 'Alterando tipo da coluna referred_by para TEXT...';
      
      -- Criar tabela temporária para backup
      CREATE TEMPORARY TABLE users_referred_by_backup AS
      SELECT id, referred_by FROM users WHERE referred_by IS NOT NULL;
      
      -- Alterar o tipo da coluna para TEXT
      ALTER TABLE users 
      ALTER COLUMN referred_by TYPE TEXT USING referred_by::TEXT;
      
      RAISE NOTICE 'Tipo da coluna referred_by alterado para TEXT com sucesso';
   ELSE
      RAISE NOTICE 'Coluna referred_by já é do tipo TEXT ou VARCHAR. Nenhuma alteração necessária.';
   END IF;
END $$;

-- Verificar novamente o tipo após alteração
SELECT data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'referred_by';