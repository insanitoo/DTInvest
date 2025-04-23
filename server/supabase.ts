import axios from 'axios';

// Conectando ao Supabase
const SUPABASE_URL = 'https://qglgynrvprxrawxtgjqk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbGd5bnJ2cHJ4cmF3eHRnanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzMzQ3MjEsImV4cCI6MjA2MDkxMDcyMX0.WbonVfM-fwOsgNLuQakAjtlN938Wiij-h7rHKjpNB7w';

// Testar a conexão com o Supabase usando REST API
export async function testSupabaseConnection() {
  try {
    // Usando a API REST do Supabase para testar a conexão
    // Testando apenas se conseguimos acessar o Supabase
    const response = await axios.get(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    console.log('Conexão com Supabase bem-sucedida!', response.data);
    return true;
  } catch (error: any) {
    console.error('Erro ao conectar ao Supabase:', error.message || 'Erro desconhecido');
    return false;
  }
}