import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { sql } from 'drizzle-orm';

// Configurar o Neon para usar WebSockets
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não está definida nas variáveis de ambiente!");
}

console.log("Conectando ao banco de dados PostgreSQL...");

// Criar pool de conexões com o banco de dados
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // Reduzido o número máximo de conexões
  idleTimeoutMillis: 30000, // Tempo máximo de inatividade
  connectionTimeoutMillis: 5000 // Tempo máximo de tentativa de conexão
});

// Adicionar handler para erros no pool
pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexão PostgreSQL', err);
});

// Inicializar Drizzle ORM
export const db = drizzle({ client: pool, schema });

// Testar conexão imediatamente
(async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`✅ Conexão de banco de dados testada com sucesso! Hora do servidor: ${result.rows[0].now}`);
  } catch (error) {
    console.error('❌ Falha ao testar conexão com o banco de dados:', error);
  }
})();
