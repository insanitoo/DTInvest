import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configurar o Neon para usar WebSockets
neonConfig.webSocketConstructor = ws;

// URL fixa do banco de dados Neon, caso não exista variável de ambiente
const defaultDatabaseUrl = "postgresql://neondb_owner:npg_a9OAdPlB7zom@ep-lingering-lab-a2boyuq3-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";

// Usar a URL do banco de dados da variável de ambiente ou a URL padrão
const databaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl;

console.log("Conectando ao banco de dados Neon...");

// Criar pool de conexões com o banco de dados
export const pool = new Pool({ 
  connectionString: databaseUrl,
  max: 20, // Máximo de conexões no pool
  idleTimeoutMillis: 30000, // Tempo máximo de inatividade
  connectionTimeoutMillis: 5000 // Tempo máximo de tentativa de conexão
});

// Inicializar Drizzle ORM
export const db = drizzle({ client: pool, schema });
