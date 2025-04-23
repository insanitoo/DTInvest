import { setupDatabase } from "./setup-database";

// Função para inicializar banco de dados
export async function initializeDatabase() {
  console.log("🔄 Inicializando banco de dados...");
  
  try {
    // Executar o script de configuração do banco de dados
    // Isso vai criar todas as tabelas e inserir dados iniciais se necessário
    const success = await setupDatabase();
    
    if (success) {
      console.log("✅ Banco de dados inicializado com sucesso!");
      return true;
    } else {
      console.error("❌ Falha ao inicializar banco de dados.");
      return false;
    }
  } catch (error) {
    console.error("❌ Erro ao inicializar banco de dados:", error);
    return false;
  }
}