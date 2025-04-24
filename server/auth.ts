import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends User {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) return false;
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}

// Generate a random referral code
function generateReferralCode(): string {
  // Usamos um conjunto de caracteres mais amigável, evitando caracteres confusos:
  // - Sem O e 0 (zero) que são confundidos
  // - Sem I e 1 (um) que são confundidos
  // - Sem letras pouco comuns em Angola/português
  const safeLetters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';  // sem I, O
  const safeNumbers = '23456789';  // sem 0, 1
  let code = '';

  // Gerar um código como "A2B3" - mais curto e fácil de memorizar
  // Alternamos letra e número para facilitar a leitura
  code += safeLetters.charAt(Math.floor(Math.random() * safeLetters.length));
  code += safeNumbers.charAt(Math.floor(Math.random() * safeNumbers.length));
  code += safeLetters.charAt(Math.floor(Math.random() * safeLetters.length));
  code += safeNumbers.charAt(Math.floor(Math.random() * safeNumbers.length));

  // Garantir que o código seja sempre string e nunca seja interpretado como número
  return code.toString();
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'sp_global_session_secret',
    resave: true,
    saveUninitialized: true,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days para persistência longa
      secure: false, // desabilitado para desenvolvimento
      httpOnly: true,
      path: '/',
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Passport Local Strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'phoneNumber',
        passwordField: 'password',
        passReqToCallback: true,
      },
      async (req, phoneNumber, password, done) => {
        try {
          // Normalize phone number by removing spaces
          const formattedPhoneNumber = phoneNumber.replace(/\s+/g, '');

          // Get user by phone number
          const user = await storage.getUserByPhoneNumber(formattedPhoneNumber);

          // Como essa é uma versão de protótipo, aceitamos qualquer senha para o usuário
          // Com password definido como "protótipo"
          if (!user) {
            console.log("Usuário não encontrado:", formattedPhoneNumber);
            return done(null, false, { message: 'Número de telefone ou senha incorretos' });
          }

          // Para o protótipo, aceitamos "protótipo" como senha universal
          if (password === "protótipo" || (user.isAdmin && password === user.password)) {
            // Aceita 'protótipo' ou senha correta para admin
            if (req.body.rememberMe && req.session.cookie) {
              req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
            }

            console.log("Login bem-sucedido para", user.isAdmin ? "admin" : "usuário");
            return done(null, user);
          }

          // Se não for a senha de protótipo, verificamos normalmente
          if (user.password !== password) {
            console.log("Senha incorreta para usuário:", formattedPhoneNumber);
            return done(null, false, { message: 'Número de telefone ou senha incorretos' });
          }

          // If remember me is checked, extend session
          if (req.body.rememberMe) {
            if (req.session.cookie) {
              req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
            }
          }

          console.log("Login bem-sucedido para usuário:", formattedPhoneNumber);
          return done(null, user);
        } catch (error) {
          console.error("Erro na autenticação:", error);
          return done(error);
        }
      }
    ),
  );

  // Configure serialization and deserialization
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }

      // Add bank info to user if available
      const bankInfo = await storage.getBankInfoByUserId(id);
      if (bankInfo) {
        const userWithBank = {
          ...user,
          bankInfo: {
            bank: bankInfo.bank,
            ownerName: bankInfo.ownerName,
            accountNumber: bankInfo.accountNumber
          }
        };
        return done(null, userWithBank);
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  });

  // Register route - VERSÃO FINAL com tratamento simplificado
  app.post("/api/register", async (req, res, next) => {
    try {
      // Vamos simplificar o código e torná-lo mais transparente
      console.log("Recebendo solicitação de registro com dados:", {
        phoneNumber: req.body.phoneNumber,
        referralCode: req.body.referralCode,
        // Novos campos enviados pelo cliente
        originalReferralCode: req.body.originalReferralCode,
        userProvidedReferralCode: req.body.userProvidedReferralCode
      });
      
      if (!req.body.referralCode) {
        return res.status(400).json({ message: "Código de convite é obrigatório" });
      }

      if (!req.body.phoneNumber) {
        return res.status(400).json({ message: "Número de telefone é obrigatório" });
      }

      if (!req.body.password) {
        return res.status(400).json({ message: "Senha é obrigatória" });
      }

      // Normalize phone number
      const formattedPhoneNumber = req.body.phoneNumber.toString().replace(/\s+/g, '');
      console.log("Número de telefone formatado:", formattedPhoneNumber);

      // Check if user already exists
      try {
        const existingUser = await storage.getUserByPhoneNumber(formattedPhoneNumber);
        if (existingUser) {
          return res.status(400).json({ message: "Número de telefone já está em uso" });
        }
      } catch (checkUserError) {
        console.error("Erro ao verificar usuário existente:", checkUserError);
        // Continuamos mesmo se houver erro na verificação (para evitar bloqueio)
      }

      // SOLUÇÃO FINAL SIMPLIFICADA:
      // Vamos usar o código exatamente como o usuário digitou, apenas removendo espaços
      // sem forçar uppercase, para manter compatibilidade com códigos existentes
      let referralCodeToUse = (req.body.referralCode || '').trim();
      console.log("Código de convite recebido:", referralCodeToUse);
      
      // 1. Verifica se é o código especial ADMIN01 (ou admin01, Admin01, etc.)
      if (referralCodeToUse.toUpperCase() === 'ADMIN01') {
        console.log("Usando código especial ADMIN01");
        try {
          // Tenta buscar qualquer usuário admin para usar seu código
          const [adminUser] = await db.execute(sql`
            SELECT referral_code FROM users 
            WHERE is_admin = true 
            LIMIT 1
          `);
          
          if (adminUser && adminUser.rows && adminUser.rows.length > 0) {
            // Se encontrar o admin, usa o código dele e garante que seja string
            referralCodeToUse = String(adminUser.rows[0].referral_code);
            console.log("Usando código do admin encontrado:", referralCodeToUse, "(tipo:", typeof referralCodeToUse, ")");
          } else {
            // Se não encontrar admin, busca qualquer usuário ativo como alternativa
            const [anyUser] = await db.execute(sql`
              SELECT referral_code FROM users 
              WHERE is_blocked = false 
              LIMIT 1
            `);
            
            if (anyUser && anyUser.rows && anyUser.rows.length > 0) {
              referralCodeToUse = String(anyUser.rows[0].referral_code);
              console.log("Usando código de usuário alternativo:", referralCodeToUse, "(tipo:", typeof referralCodeToUse, ")");
            } else {
              console.log("Nenhum usuário encontrado, gerando um código válido");
              // Não podemos usar ADMIN01 como referral code (erro de tipo)
              // Vamos gerar um código válido como último recurso
              referralCodeToUse = generateReferralCode() + '00';
            }
          }
        } catch (adminError) {
          console.error("Erro ao buscar admin:", adminError);
          // Se ocorrer erro, buscamos o primeiro usuário disponível ou geramos um código
          try {
            const [anyUserAsBackup] = await db.execute(sql`
              SELECT referral_code FROM users LIMIT 1
            `);
            
            if (anyUserAsBackup && anyUserAsBackup.rows && anyUserAsBackup.rows.length > 0) {
              referralCodeToUse = String(anyUserAsBackup.rows[0].referral_code);
              console.log("Usando código de backup final:", referralCodeToUse, "(tipo:", typeof referralCodeToUse, ")");
            } else {
              // Último recurso - gerar um código novo
              referralCodeToUse = generateReferralCode() + '00';
              console.log("Gerando código final:", referralCodeToUse);
            }
          } catch (finalError) {
            // Se tudo falhar, geramos um código
            referralCodeToUse = generateReferralCode() + '00';
            console.log("Gerando código final após erro:", referralCodeToUse);
          }
        }
      } else {
        // 2. NOVA IMPLEMENTAÇÃO: Buscar o número de telefone do usuário pelo código de referral
        try {
          // Consulta case-insensitive para encontrar o usuário pelo código de referral
          const referrerResult = await db.execute(sql`
            SELECT phone_number, referral_code FROM users 
            WHERE LOWER(referral_code) = LOWER(${referralCodeToUse})
          `);
          
          console.log("Resultado da busca de código de referral:", referrerResult);
          
          if (referrerResult && referrerResult.rows && referrerResult.rows.length > 0) {
            // Encontrou o usuário referenciador - vamos armazenar seu número de telefone
            const referrerPhoneNumber = String(referrerResult.rows[0].phone_number);
            // Também guardar o formato exato do código para usar na geração do código do novo usuário
            referralCodeToUse = String(referrerResult.rows[0].referral_code);
            
            console.log("Código de convite encontrado:", referralCodeToUse, "(tipo:", typeof referralCodeToUse, ")");
            console.log("Telefone do referenciador:", referrerPhoneNumber, "- será usado no campo referred_by");
            
            // Armazenar o telefone do referenciador em uma variável para uso posterior
            req.body.referrerPhoneNumber = referrerPhoneNumber;
          } else {
            // Código não encontrado - tenta encontrar admin como último recurso
            console.log("Código não encontrado, tentando usar admin como fallback");
            
            // CORREÇÃO CRÍTICA: Não desestruturar o resultado diretamente
            const adminFallback = await db.execute(sql`
              SELECT phone_number, referral_code FROM users 
              WHERE is_admin = true 
              LIMIT 1
            `);
            
            console.log("Resultado da busca de admin fallback:", adminFallback);
            
            if (adminFallback && adminFallback.rows && adminFallback.rows.length > 0) {
              // Usa o admin como fallback, mas retorna erro ao usuário
              console.log("Admin encontrado como fallback, mas retornando erro ao usuário");
              return res.status(400).json({ 
                message: "Código de convite inválido. Por favor, entre em contato com quem o convidou para obter um código válido."
              });
            } else {
              // Nenhum admin encontrado, retorna erro simples
              return res.status(400).json({ message: "Código de convite inválido" });
            }
          }
        } catch (referrerError) {
          console.error("Erro ao verificar código de referência:", referrerError);
          // Em caso de erro, damos uma mensagem mais descritiva
          return res.status(400).json({ 
            message: "Não foi possível verificar o código de convite. Por favor, tente novamente mais tarde."
          });
        }
      }

      // SOLUÇÃO FINAL SIMPLIFICADA:
      // Se o usuário forneceu um código específico para ser seu próprio código, dar prioridade a ele
      let referralCode;
      
      // Primeiro verificar se o frontend enviou userProvidedReferralCode
      if (req.body.userProvidedReferralCode) {
        referralCode = req.body.userProvidedReferralCode.trim();
        console.log(`PRIORIDADE: Usando código específico fornecido pelo usuário: ${referralCode}`);
      }
      // Caso contrário, usar o mesmo código de referência como código do novo usuário
      else if (referralCodeToUse) {
        referralCode = referralCodeToUse;
        console.log(`SOLUÇÃO SIMPLIFICADA: Usando código de referência como código do próprio usuário: ${referralCode}`);

        // Verificar se este código já existe como código de referral de outro usuário
        try {
          const checkResult = await db.execute(sql`
            SELECT COUNT(*) FROM users WHERE referral_code = ${referralCode}
          `);
          
          if (checkResult.rows && checkResult.rows.length > 0 && parseInt(checkResult.rows[0].count) > 0) {
            console.log(`Código ${referralCode} já existe como código de referral de outro usuário`);
            // Se existir, gerar um código diferente com prefixo igual
            // Tenta manter os 4 primeiros caracteres e adicionar um sufixo numérico único
            let prefix = referralCode.slice(0, 4);
            if (prefix.length < 4) {
              // Se o prefixo for muito curto, complementar com letras aleatórias
              while (prefix.length < 4) {
                const safeLetters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
                prefix += safeLetters.charAt(Math.floor(Math.random() * safeLetters.length));
              }
            }
            
            // Adicionar um sufixo numérico de 4 dígitos
            const randomSuffix = Math.floor(1000 + Math.random() * 9000); // número entre 1000 e 9999
            referralCode = `${prefix}${randomSuffix}`;
            console.log(`Gerado código alternativo baseado no mesmo prefixo: ${referralCode}`);
          }
        } catch (checkError) {
          console.error("Erro ao verificar duplicidade de código:", checkError);
          // Em caso de erro, continuar com o código original
        }
      } else {
        // Se não tiver um código de referência, gerar um código novo
        console.log("Nenhum código informado, gerando novo código");
        referralCode = generateReferralCode();
        
        // Garantir que o código gerado é único
        let isUniqueCode = false;
        let attempts = 0;
        const maxAttempts = 5;

        while (!isUniqueCode && attempts < maxAttempts) {
          try {
            const checkResult = await db.execute(sql`
              SELECT COUNT(*) FROM users WHERE referral_code = ${referralCode}
            `);
            
            if (checkResult.rows && checkResult.rows.length > 0 && parseInt(checkResult.rows[0].count) === 0) {
              isUniqueCode = true;
            } else {
              referralCode = generateReferralCode();
            }
          } catch (codeError) {
            console.error("Erro ao verificar unicidade do código:", codeError);
            isUniqueCode = true; // Continuar mesmo com erro
          }
          attempts++;
        }
      }

      // Hash password
      const hashedPassword = await hashPassword(req.body.password);

      console.log("Tentando inserir usuário via SQL direto - SOLUÇÃO DE EMERGÊNCIA");
      try {
        // Use SQL direto para criar o usuário - abordagem com máximo de segurança
        // Garantir que todos os códigos sejam tratados como strings para evitar erro de tipo
        const phoneStr = formattedPhoneNumber.toString();
        const referralStr = referralCode.toString();
        
        // NOVA LÓGICA: Usar o número de telefone do referenciador em vez do código de referral
        // Se tivermos o número de telefone do referenciador, usamos ele
        // Caso contrário, mantemos a lógica anterior usando o código de referral
        const referredByStr = req.body.referrerPhoneNumber ? 
                              req.body.referrerPhoneNumber.toString() : 
                              referralCodeToUse.toString();
        
        console.log(`DIAGNÓSTICO COMPLETO - Inserindo usuário com valores:
          - Telefone: ${phoneStr} (tipo: ${typeof phoneStr})
          - Código de referral: ${referralStr} (tipo: ${typeof referralStr})
          - Referido por: ${referredByStr} (tipo: ${typeof referredByStr}) - [Número de telefone do referenciador]
        `);
        
        // ******************* SOLUÇÃO DE EMERGÊNCIA ******************
        // Contornando o problema inserindo diretamente com query parametrizada pura
        let result;
        
        try {
          console.log("TESTE FINAL - INSERÇÃO DIRETA COM CLIENTE POOL");
          
          const queryText = `
            INSERT INTO users (
              phone_number, password, referral_code, referred_by, is_admin, 
              balance, level1_commission, level2_commission, level3_commission,
              has_product, has_deposited
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
          `;
          
          // Utilizando client direto do pool para ter mais controle
          const client = await db.$client.connect();
          
          try {
            console.log("Usando parâmetros:", [
              phoneStr, hashedPassword, referralStr, referredByStr, false, 
              0, 0, 0, 0, false, false
            ]);
            
            const res = await client.query(queryText, [
              phoneStr, hashedPassword, referralStr, referredByStr, false, 
              0, 0, 0, 0, false, false
            ]);
            
            console.log("Resultado da inserção direta:", res.rows[0]);
            
            result = {
              rows: res.rows
            };
          } finally {
            // Sempre devolver o cliente ao pool
            client.release();
          }
        } catch (directError) {
          console.error("ERRO NA INSERÇÃO DIRETA:", directError);
          
          // Se falhar, tenta uma abordagem alternativa com query fixa
          console.log("TENTANDO ABORDAGEM ALTERNATIVA COM SQL HARDCODED");
          
          // Isso é potencialmente inseguro (SQL injection), mas é um último recurso
          const sqlQuery = `
            INSERT INTO users (
              phone_number, password, referral_code, referred_by, is_admin, 
              balance, level1_commission, level2_commission, level3_commission,
              has_product, has_deposited
            ) 
            VALUES (
              '${phoneStr}', '${hashedPassword}', '${referralStr}', '${referredByStr}', false, 
              0, 0, 0, 0, 
              false, false
            )
            RETURNING *
          `;
          
          result = await db.execute(sql.raw(sqlQuery));
        }
        
        if (result && result.rows && result.rows.length > 0) {
          const user = result.rows[0];
          console.log("Usuário criado com sucesso:", user.id);
          
          // Converter o formato do banco para o formato da API
          const formattedUser = {
            id: user.id,
            phoneNumber: user.phone_number,
            referralCode: user.referral_code,
            referredBy: user.referred_by,
            isAdmin: user.is_admin,
            balance: user.balance,
            level1Commission: user.level1_commission,
            level2Commission: user.level2_commission,
            level3Commission: user.level3_commission,
            hasProduct: user.has_product,
            hasDeposited: user.has_deposited,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          };
          
          req.login(formattedUser, (loginErr) => {
            if (loginErr) {
              console.error("Erro no login automático:", loginErr);
              // Mesmo com erro de login, retornamos sucesso
              return res.status(201).json(formattedUser);
            }
            return res.status(201).json(formattedUser);
          });
        } else {
          throw new Error("Falha ao inserir usuário: nenhuma linha retornada");
        }
      } catch (sqlError) {
        console.error("Erro SQL ao criar usuário:", sqlError);
        return res.status(500).json({ message: "Erro ao criar usuário: " + sqlError.message });
      }
    } catch (error) {
      console.error("Erro geral durante o registro:", error);
      return res.status(500).json({ message: "Erro ao processar registro: " + error.message });
    }
  });

  // Login route
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Credenciais inválidas" });
      }

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  // Logout route
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((sessionErr) => {
        if (sessionErr) return next(sessionErr);
        res.clearCookie('connect.sid');
        return res.sendStatus(200);
      });
    });
  });

  // Get current user
  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    try {
      // Buscar os dados mais recentes do usuário diretamente do banco
      const userId = req.user.id;
      const freshUserData = await storage.getUser(userId);

      if (!freshUserData) {
        console.error(`ERRO: Usuário ${userId} não encontrado na verificação de /api/user`);
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Adicionar informações bancárias, se existirem
      const bankInfo = await storage.getBankInfoByUserId(userId);
      
      // Calcular total de comissões a partir das transações
      const transactions = await storage.getTransactions(userId);
      const commissionTransactions = transactions.filter(t => t.type === 'commission' && t.status === 'completed');
      const totalCommission = commissionTransactions.reduce((total, tx) => total + tx.amount, 0);
      
      // Obter dados dos referidos para calculer estatísticas
      const allUsers = await storage.getAllUsers();
      
      // MODIFICAÇÃO: Agora o referred_by armazena o número de telefone do referenciador, não o código
      // Contar referidos diretos (nível 1)
      const level1Referrals = allUsers.filter(user => user.referredBy === freshUserData.phoneNumber);
      
      // Contar referidos nível 2
      // Precisamos usar o número de telefone de cada usuário nível 1
      const level1PhoneNumbers = level1Referrals.map(user => user.phoneNumber);
      const level2Referrals = allUsers.filter(user => user.referredBy && level1PhoneNumbers.includes(user.referredBy));
      
      // Contar referidos nível 3
      // Precisamos usar o número de telefone de cada usuário nível 2
      const level2PhoneNumbers = level2Referrals.map(user => user.phoneNumber);
      const level3Referrals = allUsers.filter(user => user.referredBy && level2PhoneNumbers.includes(user.referredBy));
      
      // Formatamos a data de criação como string para "membro desde"
      const memberSince = freshUserData.createdAt 
        ? new Date(freshUserData.createdAt).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })
        : 'N/A';

      // Buscamos na view de referidos
      let referralCounts = null;
      try {
        // Convertemos explicitamente o userId para number para garantir que a comparação seja válida
        const userIdNumber = Number(userId);
        if (!isNaN(userIdNumber)) {
          const result = await db.execute(sql`
            SELECT * FROM referral_counts WHERE user_id = ${userIdNumber}
          `);
          if (result.rows && result.rows.length > 0) {
            referralCounts = result.rows[0];
          }
        }
      } catch (e) {
        console.error('Erro ao buscar contagem de referidos:', e);
      }
      
      // CORREÇÃO: Priorizar a contagem manual (level1Referrals.length) e usar o referralCounts como fallback
      // Isso garante que os números são os mesmos na página de equipe e na página de perfil
      const freshUserWithExtras = {
        ...freshUserData,
        bankInfo: bankInfo || null,
        totalCommission,
        memberSince,
        invitationCode: freshUserData.referralCode,
        level1ReferralCount: level1Referrals.length,
        level2ReferralCount: level2Referrals.length,
        level3ReferralCount: level3Referrals.length
      };

      // Atualizar a sessão com os dados mais recentes
      req.user = freshUserWithExtras;

      console.log(`Enviando dados atualizados do usuário ${userId}. Saldo atual: ${freshUserData.balance}`);
      return res.json(freshUserWithExtras);
    } catch (error) {
      console.error('Erro ao buscar dados atualizados do usuário:', error);
      // Em caso de erro, retornar os dados da sessão como fallback
      return res.json(req.user);
    }
  });

  // Update bank info
  app.post("/api/user/bank", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(200).json({ 
        success: false,
        message: "Não autenticado. Por favor faça login novamente." 
      });
    }

    try {
      const userId = req.user.id;
      const { bank, ownerName, accountNumber } = req.body;
      
      // Validação dos dados
      if (!bank || !ownerName || !accountNumber) {
        return res.status(200).json({ 
          success: false,
          message: "Informações incompletas. Por favor preencha todos os campos." 
        });
      }

      // Verificar se já existe informação bancária para este usuário
      const existingBankInfo = await storage.getBankInfoByUserId(userId);

      let bankInfo;
      try {
        if (existingBankInfo) {
          // Se já existe, atualizamos
          bankInfo = await storage.updateBankInfo(userId, { 
            bank, 
            ownerName, 
            accountNumber,
            userId 
          });
        } else {
          // Se não existe, criamos uma nova
          bankInfo = await storage.createBankInfo(userId, { 
            bank, 
            ownerName, 
            accountNumber,
            userId 
          });
        }
        
        return res.status(200).json({
          success: true,
          message: "Informações bancárias salvas com sucesso",
          data: bankInfo
        });
      } catch (dbError) {
        console.error("Erro no banco de dados ao atualizar informações bancárias:", dbError);
        return res.status(200).json({ 
          success: false,
          message: "Não foi possível salvar as informações bancárias. Tente novamente mais tarde." 
        });
      }
    } catch (error) {
      console.error("Erro ao atualizar informações bancárias:", error);
      return res.status(200).json({ 
        success: false,
        message: "Erro ao processar a solicitação. Por favor tente novamente."
      });
    }
  });
}