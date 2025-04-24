import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-db";
import { initScheduledTasks } from "./scheduled-tasks";

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
  
  // Inicializa o sistema de tarefas agendadas
  initScheduledTasks();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Capturar e sanitizar qualquer erro que possa ocorrer
    const status = err.status || err.statusCode || 500;
    
    // Evitar expor detalhes técnicos no erro original
    let originalMessage = "Erro interno do servidor";
    try {
      // Sanitizar a mensagem original para remover detalhes técnicos, como paths, stacktraces, etc.
      if (err.message) {
        // Remover caminhos de arquivo, stacktraces e informações sensíveis
        originalMessage = err.message
          .replace(/\/[\/\w\.-]+/g, '[caminho]') // Remove caminhos de arquivo
          .replace(/at\s+[\w\.<>\s]+\s+\([^\)]*\)/g, '[stack]') // Remove stack traces
          .replace(/Error:/g, '') // Remove prefixo "Error:"
          .replace(/SQL|PostgreSQL/gi, 'Banco de dados') // Substitui menções ao SQL/PostgreSQL
          .replace(/\s{2,}/g, ' ') // Remove múltiplos espaços
          .trim();
      }
    } catch (sanitizeError) {
      console.error("Erro ao sanitizar mensagem de erro:", sanitizeError);
      // Fallback para mensagem genérica em caso de erro na sanitização
      originalMessage = "Erro interno do servidor";
    }
    
    // Mensagens de erro mais amigáveis para o usuário
    let userFriendlyMessage;
    
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
    } else if (status >= 500) {
      userFriendlyMessage = "Erro interno no servidor. Por favor tente novamente mais tarde.";
    } else {
      // Para erros não categorizados, usar a mensagem sanitizada
      userFriendlyMessage = originalMessage;
    }
    
    // Adicionamos o erro original sanitizado apenas em ambiente de desenvolvimento
    const response: any = { 
      success: false,
      message: userFriendlyMessage 
    };
    
    if (process.env.NODE_ENV !== 'production') {
      response.originalError = originalMessage;
    }

    // Sempre retornar 200 para o cliente para manter consistência na interface
    res.status(200).json(response);
    
    // Registrar o erro completo para debugging interno, apenas no console do servidor
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