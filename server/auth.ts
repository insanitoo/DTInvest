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
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
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
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
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
          
          // If user doesn't exist or password doesn't match
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: 'Número de telefone ou senha incorretos' });
          }
          
          // If remember me is checked, extend session
          if (req.body.rememberMe) {
            if (req.session.cookie) {
              req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
            }
          }
          
          return done(null, user);
        } catch (error) {
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
      
      // Check referral code if provided
      if (!req.body.referralCode) {
        return res.status(400).json({ message: "Código de convite é obrigatório" });
      }

      const referrer = await storage.getUserByReferralCode(req.body.referralCode);
      if (!referrer) {
        return res.status(400).json({ message: "Código de convite inválido" });
      }
      const referredBy = req.body.referralCode;
      
      // Create user
      const user = await storage.createUser({
        phoneNumber: formattedPhoneNumber,
        password: await hashPassword(req.body.password),
        referralCode,
        referredBy,
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
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    return res.json(req.user);
  });
  
  // Update bank info
  app.post("/api/user/bank", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    const userId = req.user.id;
    const { bank, ownerName, accountNumber } = req.body;
    
    storage.updateBankInfo(userId, { bank, ownerName, accountNumber })
      .then(bankInfo => {
        res.status(200).json(bankInfo);
      })
      .catch(error => {
        next(error);
      });
  });
}
