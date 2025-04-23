import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") && process.env.NODE_ENV !== 'production') {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Inicializar banco de dados primeiro - isso garante que sempre exista um usuário admin
  await initializeDatabase();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Erro interno do servidor";
    
    // Mensagens de erro mais amigáveis para o usuário
    let userFriendlyMessage = message;
    
    if (status === 400) {
      userFriendlyMessage = "Pedido inválido. Por favor verifique os dados informados.";
    } else if (status === 401) {
      userFriendlyMessage = "Não autorizado. Por favor faça login novamente.";
    } else if (status === 402) {
      userFriendlyMessage = "Pagamento necessário para continuar.";
    } else if (status === 403) {
      userFriendlyMessage = "Acesso negado. Você não tem permissão para esta ação.";
    } else if (status === 404) {
      userFriendlyMessage = "Recurso não encontrado. Verifique o endereço e tente novamente.";
    } else if (status === 500) {
      userFriendlyMessage = "Erro interno no servidor. Por favor tente novamente mais tarde.";
    }
    
    // Adicionamos o erro original para debugging em ambientes de desenvolvimento
    const response: any = { message: userFriendlyMessage };
    if (process.env.NODE_ENV !== 'production') {
      response.originalError = message;
    }

    res.status(200).json(response); // Sempre retornar 200 para o cliente, mas com mensagem de erro apropriada
    
    // Registrar o erro para debugging, mas não quebrar o app
    console.error(`[ERRO ${status}]`, err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
    backlog: 100
  }, () => {
    log(`Server running at http://0.0.0.0:${port}`);
  });
})();