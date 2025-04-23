import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Verifica se está no ambiente de desenvolvimento (Replit)
const isDevelopment = process.env.REPL_ID || process.env.REPL_SLUG;

// Se não estiver no ambiente de desenvolvimento e não tiver DATABASE_URL, lança erro
if (!isDevelopment && !process.env.DATABASE_URL) {
  console.warn("Aviso: DATABASE_URL não está definido no ambiente de produção.");
  console.warn("Será necessário configurar esta variável de ambiente no Render.");
}

// Se DATABASE_URL estiver disponível, conecta ao banco de dados
let pool;
let db;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema });
    console.log("✅ Conexão com o banco de dados estabelecida com sucesso");
  } catch (error) {
    console.error("❌ Erro ao conectar com o banco de dados:", error);
    // Em produção, não continuar se não conseguir conectar ao banco
    if (!isDevelopment) {
      throw error;
    }
  }
} else {
  console.warn("⚠️ DATABASE_URL não definido, o aplicativo funcionará sem persistência de dados");
}

export { pool, db };
