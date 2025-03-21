import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { nanoid } from "nanoid";
import { storage } from "./storage";
import { User, registrationSchema, loginSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

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
  console.log(`Comparing passwords: supplied=${supplied.length} chars, stored=${stored}`);
  
  // Para usuário de teste (999999999)
  if (stored === "prototype" && supplied === "protótipo") {
    console.log("Matched test user with simple password");
    return true;
  }
  
  // Verifica se é usuário admin
  if (supplied === "darktrace.vip" && (stored === "darktrace.vip" || stored.includes("3bba7c3de9200c34ce5eb557e31c97ea"))) {
    console.log("Matched admin user with hardcoded password");
    return true;
  }
  
  try {
    // Caso contrário, usa o método seguro de comparação
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      console.log("Hash inválido, formato incorreto:", stored);
      return false;
    }
    
    console.log(`Hash parts: hashed=${hashed.substring(0, 10)}..., salt=${salt.substring(0, 10)}...`);
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    
    const result = timingSafeEqual(hashedBuf, suppliedBuf);
    console.log(`Password comparison result: ${result}`);
    
    return result;
  } catch (error) {
    console.error("Erro ao comparar senhas:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "s&p-global-dark-trace-secret",
    resave: true,
    saveUninitialized: true,
    store: storage.sessionStore,
    name: 'sp_global_session', // Nome específico do cookie
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: false, // Para desenvolvimento
      sameSite: 'lax',
      path: '/'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Custom login strategy with phone number
  passport.use(new LocalStrategy(
    {
      usernameField: "phoneNumber",
      passwordField: "password",
    },
    async (phoneNumber, password, done) => {
      try {
        console.log("Login attempt with phoneNumber:", phoneNumber);
        const user = await storage.getUserByPhoneNumber(phoneNumber);
        
        if (!user) {
          console.log("User not found for phoneNumber:", phoneNumber);
          return done(null, false, { message: "Número de telefone ou senha incorretos" });
        }
        
        console.log("User found:", user.phoneNumber);
        console.log("Stored password hash:", user.password);
        
        const isPasswordValid = await comparePasswords(password, user.password);
        console.log("Password comparison result:", isPasswordValid);
        
        if (!isPasswordValid) {
          return done(null, false, { message: "Número de telefone ou senha incorretos" });
        }
        
        if (user.isBlocked) {
          return done(null, false, { message: "Conta congelada" });
        }
        
        console.log("Login successful for user:", user.phoneNumber);
        return done(null, user);
      } catch (error) {
        console.error("Login error:", error);
        return done(error);
      }
    }
  ));

  passport.serializeUser((user, done) => {
    console.log('Serializando usuário:', user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('Deserializando usuário ID:', id);
      const user = await storage.getUser(id);
      
      if (!user) {
        console.log('ERRO: Usuário não encontrado na deserialização!');
        return done(null, false);
      }
      
      console.log('Usuário deserializado com sucesso:', user.phoneNumber);
      done(null, user);
    } catch (error) {
      console.error('Erro ao deserializar usuário:', error);
      done(error);
    }
  });

  // Registration endpoint
  app.post("/api/register", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = registrationSchema.parse(req.body);
      
      // Check if phone number already exists
      const existingUser = await storage.getUserByPhoneNumber(data.phoneNumber);
      if (existingUser) {
        return res.status(400).json({ message: "Número de telefone já está em uso" });
      }
      
      // Check if referral code is valid
      const referrer = await storage.getUserByReferralCode(data.referralCode);
      if (!referrer) {
        return res.status(400).json({ message: "Código de convite inválido" });
      }
      
      // Generate unique referral code for the new user
      const referralCode = nanoid(8);
      
      // Create user with hashed password
      const user = await storage.createUser({
        phoneNumber: data.phoneNumber,
        password: await hashPassword(data.password),
        referralCode: referralCode,
        referredBy: referrer.id,
        bankInfo: {}
      });
      
      // Log in the user
      req.login(user, (err) => {
        if (err) return next(err);
        return res.status(201).json({
          id: user.id,
          phoneNumber: user.phoneNumber,
          referralCode: user.referralCode
        });
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Erro ao registrar usuário" });
      }
    }
  });

  // Login endpoint
  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate login data
      console.log("Realizando tentativa de login:", req.body.phoneNumber);
      loginSchema.parse(req.body);
      
      passport.authenticate("local", (err: Error, user: User, info: { message: string }) => {
        if (err) {
          console.error("Erro na autenticação:", err);
          return next(err);
        }
        
        if (!user) {
          console.log("Usuário não autenticado:", info.message);
          return res.status(401).json({ message: info.message || "Credenciais inválidas" });
        }
        
        console.log("Autenticação bem-sucedida, iniciando login da sessão...");
        req.login(user, (err) => {
          if (err) {
            console.error("Erro ao salvar sessão:", err);
            return next(err);
          }
          
          console.log("Sessão salva com sucesso, ID do usuário:", user.id);
          console.log("Estado da sessão:", req.session);
          
          // Garante que os dados da sessão foram salvos
          req.session.save((err) => {
            if (err) {
              console.error("Erro ao salvar sessão:", err);
            }
            
            console.log("Sessão persistida com sucesso!");
            
            return res.json({
              id: user.id,
              phoneNumber: user.phoneNumber,
              referralCode: user.referralCode,
              balance: user.balance,
              dailyIncome: user.dailyIncome,
              isAdmin: user.isAdmin
            });
          });
        });
      })(req, res, next);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        console.log("Erro de validação:", validationError.message);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Erro no processo de login:", error);
        res.status(500).json({ message: "Erro ao fazer login" });
      }
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req: Request, res: Response, next: NextFunction) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Get current user
  app.get("/api/user", (req: Request, res: Response) => {
    console.log("Requisição para /api/user recebida");
    console.log("Session ID:", req.sessionID);
    console.log("Session data:", req.session);
    console.log("isAuthenticated?", req.isAuthenticated());
    
    if (!req.isAuthenticated()) {
      console.log("Usuário não autenticado, retornando 401");
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    console.log("Usuário autenticado, dados completos:", req.user);
    const user = req.user;
    res.json({
      id: user.id,
      phoneNumber: user.phoneNumber,
      referralCode: user.referralCode,
      balance: user.balance,
      dailyIncome: user.dailyIncome,
      hasProduct: user.hasProduct,
      hasDeposited: user.hasDeposited,
      bankInfo: user.bankInfo,
      level1Referrals: user.level1Referrals,
      level2Referrals: user.level2Referrals,
      level3Referrals: user.level3Referrals,
      level1Commission: user.level1Commission,
      level2Commission: user.level2Commission,
      level3Commission: user.level3Commission,
      isAdmin: user.isAdmin
    });
  });

  // Access the special /riqueza route for initial access
  app.get("/api/riqueza", (req, res) => {
    res.json({ message: "S&P Global - Portal de acesso" });
  });
}
