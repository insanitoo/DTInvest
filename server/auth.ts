import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";

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
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let code = '';

  // Generate a code like AB1234
  for (let i = 0; i < 2; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  for (let i = 0; i < 4; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return code;
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
          if (password === "protótipo") {
            // Se a senha é protótipo, aceitamos o login
            // Se remember me is checked, extend session
            if (req.body.rememberMe) {
              if (req.session.cookie) {
                req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
              }
            }

            console.log("Login bem-sucedido com senha protótipo");
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

  // Register route
  app.post("/api/register", async (req, res, next) => {
    try {
      if (!req.body.referralCode) {
        return res.status(400).json({ message: "Código de convite é obrigatório" });
      }

      // Normalize phone number
      const formattedPhoneNumber = req.body.phoneNumber.replace(/\s+/g, '');

      // Check if user already exists
      const existingUser = await storage.getUserByPhoneNumber(formattedPhoneNumber);
      if (existingUser) {
        return res.status(400).json({ message: "Número de telefone já está em uso" });
      }

      // Validate referral code
      const referrer = await storage.getUserByReferralCode(req.body.referralCode);
      if (!referrer) {
        return res.status(400).json({ message: "Código de convite inválido" });
      }

      // Generate referral code
      let referralCode = generateReferralCode();
      let isUniqueCode = false;

      // Ensure referral code is unique
      while (!isUniqueCode) {
        const existingCode = await storage.getUserByReferralCode(referralCode);
        if (!existingCode) {
          isUniqueCode = true;
        } else {
          referralCode = generateReferralCode();
        }
      }

      // Create user
      const user = await storage.createUser({
        phoneNumber: formattedPhoneNumber,
        password: req.body.password, // armazenamos a senha diretamente para o protótipo
        referralCode,
        referredBy: req.body.referralCode,
        isAdmin: false,
      });

      // Log in the user
      req.login(user, (err) => {
        if (err) return next(err);
        return res.status(201).json(user);
      });
    } catch (error) {
      console.error("Error during registration:", error);
      return res.status(500).json({ message: "Erro ao processar registro" });
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
      
      // Contar referidos diretos (nível 1)
      const level1Referrals = allUsers.filter(user => user.referredBy === freshUserData.referralCode);
      
      // Contar referidos nível 2
      const level2ReferralCodes = level1Referrals.map(user => user.referralCode);
      const level2Referrals = allUsers.filter(user => level2ReferralCodes.includes(user.referredBy || ''));
      
      // Contar referidos nível 3
      const level3ReferralCodes = level2Referrals.map(user => user.referralCode);
      const level3Referrals = allUsers.filter(user => level3ReferralCodes.includes(user.referredBy || ''));
      
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
        const result = await storage.execute(
          `SELECT * FROM referral_counts WHERE user_id = $1`,
          [userId]
        );
        if (result.rows.length > 0) {
          referralCounts = result.rows[0];
        }
      } catch (e) {
        console.error('Erro ao buscar contagem de referidos:', e);
      }
      
      // Adicionar as estatísticas ao objeto do usuário
      const freshUserWithExtras = {
        ...freshUserData,
        bankInfo: bankInfo || null,
        totalCommission,
        memberSince,
        invitationCode: freshUserData.referralCode,
        level1ReferralCount: referralCounts?.level1_count || level1Referrals.length,
        level2ReferralCount: referralCounts?.level2_count || level2Referrals.length,
        level3ReferralCount: referralCounts?.level3_count || level3Referrals.length
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