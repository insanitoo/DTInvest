/**
 * Script para corrigir os códigos de referral no banco de dados
 * Garante que todos os códigos sejam strings válidas e não números
 */
import { db } from './db';
import { sql } from 'drizzle-orm';

// Função para gerar um código de referral de 4 caracteres (letras/números)
function generateReferralCode(): string {
  // Usamos um conjunto de caracteres mais amigável
  const safeLetters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';  // sem I, O
  const safeNumbers = '23456789';  // sem 0, 1
  
  let code = '';
  // Gerar um código como "A2B3" - mais curto e fácil de memorizar
  code += safeLetters.charAt(Math.floor(Math.random() * safeLetters.length));
  code += safeNumbers.charAt(Math.floor(Math.random() * safeNumbers.length));
  code += safeLetters.charAt(Math.floor(Math.random() * safeLetters.length));
  code += safeNumbers.charAt(Math.floor(Math.random() * safeNumbers.length));

  return code;
}

// Função para verificar se um código já existe
async function codeExists(code: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM users WHERE referral_code = ${code}
  `);
  
  if (result?.rows?.[0]?.count > 0) {
    return true;
  }
  return false;
}

// Função para obter um código único
async function getUniqueCode(): Promise<string> {
  let code = generateReferralCode();
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 10) {
    const exists = await codeExists(code);
    if (!exists) {
      isUnique = true;
    } else {
      code = generateReferralCode();
      attempts++;
    }
  }
  
  return code;
}

// Função para corrigir os códigos de referral para todos os usuários
async function fixAllReferralCodes() {
  try {
    console.log('🔄 Iniciando correção de códigos de referral...');
    
    // 1. Primeiro, vamos buscar todos os usuários
    const result = await db.execute(sql`
      SELECT id, phone_number, referral_code, referred_by, is_admin FROM users
    `);
    
    if (!result?.rows) {
      console.log('❌ Nenhum usuário encontrado.');
      return;
    }
    
    const users = result.rows;
    console.log(`ℹ️ Encontrados ${users.length} usuários para verificação.`);
    
    // 2. Vamos primeiro atualizar o admin para garantir que ele tenha um código válido
    const adminUsers = users.filter(u => u.is_admin);
    if (adminUsers.length > 0) {
      for (const admin of adminUsers) {
        // Gerar novo código para admin
        const adminCode = await getUniqueCode();
        console.log(`🔑 Atualizando código de admin ${admin.phone_number}: ${adminCode}`);
        
        await db.execute(sql`
          UPDATE users SET referral_code = ${adminCode} WHERE id = ${admin.id}
        `);
      }
    } else {
      console.log('⚠️ Nenhum usuário admin encontrado.');
    }
    
    // 3. Agora atualizamos todos os outros usuários
    const regularUsers = users.filter(u => !u.is_admin);
    console.log(`ℹ️ Atualizando ${regularUsers.length} usuários regulares...`);
    
    for (const user of regularUsers) {
      // Verificar se o código atual é válido (string de caracteres)
      const currentCode = user.referral_code;
      const needsUpdate = 
        !currentCode || 
        typeof currentCode !== 'string' || 
        currentCode.length < 4 ||
        !isNaN(Number(currentCode));
      
      if (needsUpdate) {
        const newCode = await getUniqueCode();
        console.log(`🔄 Usuário ${user.phone_number}: Atualizando código ${currentCode} -> ${newCode}`);
        
        await db.execute(sql`
          UPDATE users SET referral_code = ${newCode} WHERE id = ${user.id}
        `);
      } else {
        console.log(`✅ Usuário ${user.phone_number}: Código ${currentCode} já é válido.`);
      }
    }
    
    // 4. Agora, atualizamos as referências entre usuários
    // Primeiro obtemos a lista atualizada de todos os usuários
    const updatedResult = await db.execute(sql`
      SELECT id, phone_number, referral_code, referred_by FROM users
    `);
    
    if (!updatedResult?.rows) {
      console.log('❌ Erro ao obter usuários atualizados.');
      return;
    }
    
    const updatedUsers = updatedResult.rows;
    const validCodes = updatedUsers.map(u => u.referral_code);
    
    // Verificar e corrigir referred_by para cada usuário
    for (const user of updatedUsers) {
      const referredBy = user.referred_by;
      
      // Se o referred_by não existe na lista de códigos válidos
      if (referredBy && !validCodes.includes(referredBy)) {
        console.log(`⚠️ Usuário ${user.phone_number}: Referência inválida ${referredBy}`);
        
        // Encontre o admin mais recente como referência padrão
        const adminResult = await db.execute(sql`
          SELECT referral_code FROM users WHERE is_admin = true ORDER BY id DESC LIMIT 1
        `);
        
        if (adminResult?.rows?.[0]?.referral_code) {
          const adminCode = adminResult.rows[0].referral_code;
          console.log(`🔄 Usuário ${user.phone_number}: Atualizando referência para ${adminCode}`);
          
          await db.execute(sql`
            UPDATE users SET referred_by = ${adminCode} WHERE id = ${user.id}
          `);
        }
      }
    }
    
    console.log('✅ Correção de códigos de referral concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante a correção dos códigos de referral:', error);
  }
}

// Executar a função principal
fixAllReferralCodes().then(() => {
  console.log('Script finalizado.');
  process.exit(0);
}).catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});