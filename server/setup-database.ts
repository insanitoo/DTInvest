import { db } from "./db";
import { sql } from "drizzle-orm";
import { 
  users, 
  transactions, 
  depositRequests, 
  withdrawalRequests, 
  bankInfo, 
  products, 
  purchases, 
  socialLinks, 
  banks, 
  settings, 
  carouselImages, 
  bankAccountDetails 
} from "../shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function setupDatabase() {
  console.log("🔄 Iniciando configuração do banco de dados...");

  try {
    // Verificar conexão com o banco
    console.log("Testando conexão com o banco de dados...");
    await db.execute(sql`SELECT 1`);
    console.log("✅ Conexão com o banco de dados estabelecida com sucesso!");

    // 1. Criar tabela de usuários com campos adicionais
    console.log("Criando tabela de usuários...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        phone_number TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        balance DOUBLE PRECISION NOT NULL DEFAULT 0,
        referral_code TEXT NOT NULL UNIQUE,
        referred_by INTEGER REFERENCES users(id),
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
        has_deposited BOOLEAN NOT NULL DEFAULT FALSE,
        has_purchased BOOLEAN NOT NULL DEFAULT FALSE,
        has_product BOOLEAN NOT NULL DEFAULT FALSE,
        level1_commission DOUBLE PRECISION NOT NULL DEFAULT 0,
        level2_commission DOUBLE PRECISION NOT NULL DEFAULT 0,
        level3_commission DOUBLE PRECISION NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Verificar e adicionar as colunas de comissão se não existirem
    try {
      console.log("Verificando colunas de comissão...");
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'level1_commission') THEN
            ALTER TABLE users ADD COLUMN level1_commission DOUBLE PRECISION NOT NULL DEFAULT 0;
          END IF;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'level2_commission') THEN
            ALTER TABLE users ADD COLUMN level2_commission DOUBLE PRECISION NOT NULL DEFAULT 0;
          END IF;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'level3_commission') THEN
            ALTER TABLE users ADD COLUMN level3_commission DOUBLE PRECISION NOT NULL DEFAULT 0;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'has_product') THEN
            ALTER TABLE users ADD COLUMN has_product BOOLEAN NOT NULL DEFAULT FALSE;
          END IF;
        END
        $$;
      `);
      console.log("✅ Colunas de comissão verificadas/adicionadas");
    } catch (error) {
      console.error("⚠️ Erro ao verificar/adicionar colunas de comissão:", error);
    }

    console.log("✅ Tabela 'users' criada/verificada");

    // 2. Criar tabela de transações
    console.log("Criando tabela de transações...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        status TEXT NOT NULL,
        transaction_id TEXT,
        bank_account TEXT,
        bank_name TEXT,
        receipt TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela 'transactions' criada/verificada");

    // 3. Criar tabela de solicitações de depósito
    console.log("Criando tabela de solicitações de depósito...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deposit_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount DOUBLE PRECISION NOT NULL,
        transaction_id TEXT NOT NULL,
        bank_name TEXT,
        receipt TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela 'deposit_requests' criada/verificada");

    // 4. Criar tabela de solicitações de saque
    console.log("Criando tabela de solicitações de saque...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount DOUBLE PRECISION NOT NULL,
        bank_account TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        status TEXT NOT NULL,
        processed_at TIMESTAMP,
        processed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela 'withdrawal_requests' criada/verificada");

    // 5. Criar tabela para informações bancárias
    console.log("Criando tabela de informações bancárias...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bank_info (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
        bank TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela 'bank_info' criada/verificada");

    // 6. Criar tabela para produtos
    console.log("Criando tabela de produtos...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price DOUBLE PRECISION NOT NULL,
        return_rate DOUBLE PRECISION NOT NULL,
        cycle_days INTEGER NOT NULL,
        daily_income DOUBLE PRECISION NOT NULL,
        total_return DOUBLE PRECISION NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela 'products' criada/verificada");

    // 7. Criar tabela para compras
    console.log("Criando tabela de compras...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        amount DOUBLE PRECISION NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela 'purchases' criada/verificada");

    // 8. Criar tabela para links sociais
    console.log("Criando tabela de links sociais...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS social_links (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        icon TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela 'social_links' criada/verificada");

    // 9. Criar tabela para bancos
    console.log("Criando tabela de bancos...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS banks (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        logo TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela 'banks' criada/verificada");

    // 10. Criar tabela para configurações
    console.log("Criando tabela de configurações...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela 'settings' criada/verificada");

    // 11. Criar tabela para imagens do carrossel
    console.log("Criando tabela para imagens do carrossel...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS carousel_images (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        image_url TEXT NOT NULL,
        link_url TEXT,
        "order" INTEGER DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela 'carousel_images' criada/verificada");

    // 12. Criar tabela para detalhes de contas bancárias
    console.log("Criando tabela para detalhes de contas bancárias...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bank_account_details (
        id SERIAL PRIMARY KEY,
        bank_id INTEGER NOT NULL REFERENCES banks(id),
        account_holder TEXT NOT NULL,
        iban TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela 'bank_account_details' criada/verificada");

    // 13. Criar view para visualizar a contagem de referidos por nível
    console.log("Criando view de referidos...");
    try {
      await db.execute(sql`
        CREATE OR REPLACE VIEW referral_counts AS
        WITH RECURSIVE referral_tree AS (
          -- Base case: all users
          SELECT 
            id, 
            phone_number, 
            referral_code, 
            referred_by, 
            balance,
            has_product,
            0 AS level
          FROM users

          UNION ALL

          -- Recursive case: all users referred by users in the previous level
          SELECT 
            u.id, 
            u.phone_number, 
            u.referral_code, 
            u.referred_by, 
            u.balance,
            u.has_product,
            rt.level + 1
          FROM users u
          JOIN referral_tree rt ON 
            u.referred_by = rt.referral_code
          WHERE rt.level < 3 -- Limit to 3 levels
        )

        SELECT 
          u.id AS user_id,
          COUNT(CASE WHEN r.level = 1 THEN 1 ELSE NULL END) AS level1_count,
          COUNT(CASE WHEN r.level = 2 THEN 1 ELSE NULL END) AS level2_count,
          COUNT(CASE WHEN r.level = 3 THEN 1 ELSE NULL END) AS level3_count,
          SUM(CASE WHEN r.level = 1 AND r.has_product = true THEN 1 ELSE 0 END) AS level1_active,
          SUM(CASE WHEN r.level = 2 AND r.has_product = true THEN 1 ELSE 0 END) AS level2_active,
          SUM(CASE WHEN r.level = 3 AND r.has_product = true THEN 1 ELSE 0 END) AS level3_active
        FROM users u
        LEFT JOIN referral_tree r ON 
          r.referred_by = u.id
        GROUP BY u.id;
      `);
      console.log("✅ View 'referral_counts' criada/atualizada");
    } catch (error) {
      console.error("⚠️ Erro ao criar view de referidos:", error);
      
      // Tentativa alternativa sem recursão para evitar problemas de compatibilidade
      console.log("Tentando criar view de referidos de forma simplificada...");
      try {
        await db.execute(sql`
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
        `);
        console.log("✅ View simplificada 'referral_counts' criada com sucesso!");
      } catch (fallbackError) {
        console.error("⚠️ Erro na criação da view simplificada:", fallbackError);
      }
    }

    // Criar usuário admin se não existir
    console.log("Verificando usuário administrador...");
    const adminUsers = await db.execute(sql`SELECT * FROM users WHERE phone_number = '999999999'`);

    if (adminUsers.rows.length === 0) {
      console.log("Criando usuário administrador...");
      const hashedPassword = await hashPassword("protótipo");

      await db.execute(
        sql`INSERT INTO users (phone_number, password, referral_code, is_admin) 
            VALUES ('999999999', ${hashedPassword}, 'ADMIN01', true)`
      );

      console.log("✅ Usuário administrador criado com sucesso!");
    } else {
      console.log("✅ Usuário administrador já existe, pulando criação");
    }

    // Criar bancos padrão se não existirem
    console.log("Verificando bancos padrão...");
    const existingBanks = await db.execute(sql`SELECT * FROM banks`);

    if (existingBanks.rows.length === 0) {
      console.log("Criando bancos padrão...");

      await db.execute(
        sql`INSERT INTO banks (name, active) VALUES ('BAI', true), ('Banco Atlântico', true), ('BIC', true)`
      );

      console.log("✅ Bancos padrão criados com sucesso!");
    } else {
      console.log("✅ Bancos já existem, verificando BIC...");
      
      // Verificar se o banco BIC existe
      const bicExists = existingBanks.rows.some(bank => bank.name === 'BIC');
      
      if (!bicExists) {
        console.log("Adicionando banco BIC...");
        await db.execute(sql`INSERT INTO banks (name, active) VALUES ('BIC', true)`);
        console.log("✅ Banco BIC adicionado com sucesso!");
      }
    }

    // Criar detalhes das contas bancárias para os bancos
    console.log("Verificando detalhes das contas bancárias...");
    const existingBankDetails = await db.execute(sql`SELECT * FROM bank_account_details`);

    if (existingBankDetails.rows.length === 0) {
      console.log("Criando detalhes das contas bancárias...");

      // Obter IDs dos bancos
      const banks = await db.execute(sql`SELECT id, name FROM banks`);
      const baiBank = banks.rows.find(bank => bank.name === 'BAI');
      const atlanticoBank = banks.rows.find(bank => bank.name === 'Banco Atlântico');
      const bicBank = banks.rows.find(bank => bank.name === 'BIC');

      if (baiBank && atlanticoBank && bicBank) {
        await db.execute(
          sql`INSERT INTO bank_account_details (bank_id, account_holder, iban) 
               VALUES 
               (${baiBank.id}, 'Mario Tchicassa', '004000009614317310133'),
               (${atlanticoBank.id}, 'Mario Tchicassa', '005500004514753710102'),
               (${bicBank.id}, 'Emanuel António', '0051 0000 83515613101 79')`
        );

        console.log("✅ Detalhes das contas bancárias criados com sucesso!");
      } else {
        console.log("⚠️ Não foi possível criar detalhes das contas bancárias: bancos não encontrados");
      }
    } else {
      console.log("✅ Detalhes das contas bancárias já existem, verificando conta BIC...");
      
      // Verificar se existe detalhes da conta do BIC
      const bicBankAccount = await db.execute(sql`
        SELECT bd.* FROM bank_account_details bd
        JOIN banks b ON bd.bank_id = b.id
        WHERE b.name = 'BIC'
      `);
      
      if (bicBankAccount.rows.length === 0) {
        // Obter ID do banco BIC
        const bicBankResult = await db.execute(sql`SELECT id FROM banks WHERE name = 'BIC'`);
        
        if (bicBankResult.rows.length > 0) {
          const bicBankId = bicBankResult.rows[0].id;
          console.log("Adicionando detalhes da conta do BIC...");
          
          await db.execute(sql`
            INSERT INTO bank_account_details (bank_id, account_holder, iban)
            VALUES (${bicBankId}, 'Emanuel António', '0051 0000 83515613101 79')
          `);
          
          console.log("✅ Detalhes da conta do BIC adicionados com sucesso!");
        }
      }
    }

    // Criar produtos padrão se não existirem
    console.log("Verificando produtos...");
    const existingProducts = await db.execute(sql`SELECT * FROM products`);

    if (existingProducts.rows.length === 0) {
      console.log("Criando produtos padrão...");

      // IMPORTANTE: Produtos atualizados (sem o Plano Premium de 25.000 KZ que não pode ser excluído)
      await db.execute(
        sql`INSERT INTO products (name, description, price, return_rate, cycle_days, daily_income, total_return, active) 
             VALUES 
             ('Produto Básico', 'Produto para iniciantes com retorno moderado', 2000, 2, 30, 133, 4000, true),
             ('Produto VIP', 'Produto exclusivo com alto retorno garantido', 10000, 3.5, 30, 1167, 35000, true)`
      );

      console.log("✅ Produtos padrão criados com sucesso!");
    } else {
      console.log("✅ Produtos já existem, verificando o produto Premium de 25.000 KZ...");
      
      // Verificar se existe o produto problemático (Plano Premium de 25.000 KZ) e remover
      const premiumProduct = await db.execute(sql`
        SELECT * FROM products 
        WHERE name = 'Plano Premium' AND price = 25000 
        OR description LIKE '%Melhor opção de retorno para investidores%'
      `);
      
      if (premiumProduct.rows.length > 0) {
        console.log("⚠️ Encontrado produto problemático (Plano Premium de 25.000 KZ), removendo...");
        
        for (const product of premiumProduct.rows) {
          await db.execute(sql`DELETE FROM products WHERE id = ${product.id}`);
          console.log(`✅ Produto problemático com ID ${product.id} removido com sucesso!`);
        }
      } else {
        console.log("✅ Produto problemático não encontrado, nada a fazer");
      }
    }

    console.log("🎉 Configuração do banco de dados concluída com sucesso!");
    return true;
  } catch (error) {
    console.error("❌ Erro durante a configuração do banco de dados:", error);
    return false;
  }
}