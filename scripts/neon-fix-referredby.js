/**
 * Script para corrigir a coluna referred_by na tabela users no banco NEON
 * Altera o tipo de INTEGER para TEXT para compatibilidade com códigos de referência
 * 
 * Utilize a variável de ambiente DATABASE_URL para se conectar ao Neon:
 * DATABASE_URL=postgres://user:password@hostname/dbname
 */

// Importação da biblioteca Neon
const { Pool } = require('@neondatabase/serverless');

async function fixNeonReferredByColumn() {
  console.log('🔄 Iniciando correção da coluna referred_by na tabela users do banco NEON...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ Variável de ambiente DATABASE_URL não definida!');
    console.log('Por favor, defina DATABASE_URL com a URL de conexão do banco NEON.');
    process.exit(1);
  }
  
  // Criar conexão com o banco NEON
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Verificar primeiro se a coluna é INTEGER
    const checkQuery = `
      SELECT data_type
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'referred_by';
    `;
    
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      console.log('❌ Coluna referred_by não encontrada na tabela users');
      return;
    }
    
    const dataType = checkResult.rows[0].data_type;
    console.log(`📊 Tipo atual da coluna referred_by: ${dataType}`);
    
    // Se não for do tipo TEXT, alterar
    if (dataType.toLowerCase() !== 'text' && dataType.toLowerCase() !== 'character varying') {
      console.log('🔄 Alterando tipo da coluna referred_by de INTEGER para TEXT...');
      
      // Primeiro, fazer backup dos valores existentes
      console.log('📦 Criando backup dos valores existentes...');
      await pool.query(`
        CREATE TEMPORARY TABLE users_referred_by_backup AS
        SELECT id, referred_by FROM users WHERE referred_by IS NOT NULL;
      `);
      
      // Alterar o tipo da coluna para TEXT
      console.log('🔄 Executando ALTER TABLE...');
      await pool.query(`
        ALTER TABLE users 
        ALTER COLUMN referred_by TYPE TEXT USING referred_by::TEXT;
      `);
      
      console.log('✅ Tipo da coluna referred_by alterado para TEXT com sucesso');
      
      // Verificar dados após alteração
      console.log('🔍 Verificando dados de referral após alteração...');
      const referralData = await pool.query(`
        SELECT id, phone_number, referred_by 
        FROM users 
        WHERE referred_by IS NOT NULL 
        LIMIT 5;
      `);
      
      if (referralData.rows.length > 0) {
        console.log('📋 Amostra de dados de referral após alteração:');
        console.table(referralData.rows);
      } else {
        console.log('ℹ️ Nenhum usuário com referred_by encontrado na amostra');
      }
      
      // Limpar a tabela temporária
      await pool.query(`
        DROP TABLE IF EXISTS users_referred_by_backup;
      `);
      
      console.log('🔍 Verificando tipo atualizado...');
      const verifyResult = await pool.query(checkQuery);
      
      if (verifyResult.rows.length > 0) {
        console.log(`📊 Novo tipo da coluna referred_by: ${verifyResult.rows[0].data_type}`);
      }
    } else {
      console.log('✅ Coluna referred_by já é do tipo TEXT. Nenhuma alteração necessária.');
    }
    
    console.log('🎉 Correção da coluna referred_by concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao corrigir coluna referred_by:', error);
  } finally {
    // Fechar a conexão
    await pool.end();
  }
}

// Executar a função principal
fixNeonReferredByColumn().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});