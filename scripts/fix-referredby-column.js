/**
 * Script para corrigir a coluna referred_by na tabela users
 * Altera o tipo de INTEGER para TEXT para compatibilidade com o código de referência
 */

import { db, pool } from '../server/db.ts';

async function fixReferredByColumn() {
  console.log('🔄 Iniciando correção da coluna referred_by na tabela users...');
  
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
      
      // Primeiro, fazer backup dos valores existentes (salvando IDs em uma tabela temporária)
      await pool.query(`
        CREATE TEMPORARY TABLE users_referred_by_backup AS
        SELECT id, referred_by FROM users WHERE referred_by IS NOT NULL;
      `);
      
      // Alterar o tipo da coluna para TEXT
      await pool.query(`
        ALTER TABLE users 
        ALTER COLUMN referred_by TYPE TEXT USING referred_by::TEXT;
      `);
      
      console.log('✅ Tipo da coluna referred_by alterado para TEXT com sucesso');
      
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
fixReferredByColumn();