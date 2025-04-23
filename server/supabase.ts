import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "@shared/schema";

// Conectando ao Supabase
const SUPABASE_URL = 'https://qglgynrvprxrawxtgjqk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbGd5bnJ2cHJ4cmF3eHRnanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzMzQ3MjEsImV4cCI6MjA2MDkxMDcyMX0.WbonVfM-fwOsgNLuQakAjtlN938Wiij-h7rHKjpNB7w';

// Formato de conexão para o Supabase PostgreSQL
const DB_URL = 'postgres://postgres.qglgynrvprxrawxtgjqk:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbGd5bnJ2cHJ4cmF3eHRnanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzMzQ3MjEsImV4cCI6MjA2MDkxMDcyMX0.WbonVfM-fwOsgNLuQakAjtlN938Wiij-h7rHKjpNB7w@db.qglgynrvprxrawxtgjqk.supabase.co:5432/postgres';

// Configuração direta para o Supabase
export const supabasePool = new Pool({
  connectionString: DB_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Testar a conexão com o Supabase
export async function testSupabaseConnection() {
  try {
    const client = await supabasePool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('Conexão com Supabase bem-sucedida!', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Erro ao conectar ao Supabase:', error);
    return false;
  }
}

// Só inicializa o Drizzle se a conexão for bem-sucedida
let supabaseDb: any = null;

export async function initializeSupabaseDb() {
  const isConnected = await testSupabaseConnection();
  if (isConnected) {
    supabaseDb = drizzle({ client: supabasePool, schema });
    console.log('Supabase DB inicializado com sucesso!');
    return supabaseDb;
  } else {
    console.error('Falha ao inicializar o Supabase DB.');
    return null;
  }
}