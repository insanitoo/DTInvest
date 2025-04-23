import { storage } from "./storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Função para garantir que o admin exista
export async function ensureAdminExists() {
  try {
    // Verificar se o usuário admin com phoneNumber 999999999 já existe
    const adminUser = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, "999999999"))
      .limit(1);

    if (adminUser.length === 0) {
      console.log("🔄 Criando usuário admin...");
      // Se não existir, criar o usuário admin
      await storage.createUser({
        phoneNumber: "999999999", 
        password: await hashPassword("protótipo"),
        isAdmin: true,
        referralCode: "ADMIN01"
      });
      console.log("✅ Usuário admin criado com sucesso!");
    } else {
      console.log("✅ Usuário admin já existe, pulando criação");
    }
  } catch (error) {
    console.error("❌ Erro ao verificar/criar usuário admin:", error);
  }
}

// Função para inicializar bancos de dados
export async function initializeDatabase() {
  console.log("🔄 Inicializando banco de dados...");
  
  try {
    // Garantir que o usuário admin existe
    await ensureAdminExists();
    console.log("✅ Banco de dados inicializado com sucesso!");
    return true;
  } catch (error) {
    console.error("❌ Erro ao inicializar banco de dados:", error);
    return false;
  }
}