// Middleware para gerenciar conexões de database de forma inteligente
const { prisma } = require('../config/prisma');

// Queue para gerenciar operações de database sequencialmente quando necessário
class DatabaseQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = 3; // Máximo 3 operações simultâneas
    this.currentOperations = 0;
  }

  async add(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    if (this.currentOperations >= this.maxConcurrent) return;

    this.processing = true;
    const { operation, resolve, reject } = this.queue.shift();
    this.currentOperations++;

    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.currentOperations--;
      this.processing = false;
      
      // Processar próxima operação se houver
      if (this.queue.length > 0 && this.currentOperations < this.maxConcurrent) {
        setImmediate(() => this.process());
      }
    }
  }
}

const dbQueue = new DatabaseQueue();

// Middleware para rate limiting de queries
const connectionLimiter = (req, res, next) => {
  // Adicionar informações de conexão ao request
  req.dbQueue = dbQueue;
  req.safeQuery = async (queryFn) => {
    // Para operações críticas, usar a queue
    if (req.headers['x-critical-query'] === 'true') {
      return dbQueue.add(queryFn);
    }
    
    // Para operações normais, executar diretamente
    return queryFn();
  };
  
  next();
};

// Helper para executar queries com retry automático
const safeQuery = async (queryFn, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await queryFn();
    } catch (error) {
      // Se excedeu conexões, aguardar e tentar novamente
      if (error.message.includes('max_connections') && i < retries) {
        console.log(`🔄 Connection limit hit, retrying in ${(i + 1) * 2}s...`);
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
        continue;
      }
      
      // Se timeout, tentar reconectar
      if (error.message.includes('timeout') && i < retries) {
        console.log(`⏱️  Query timeout, retrying...`);
        try {
          await prisma.$disconnect();
          await prisma.$connect();
        } catch (reconnectError) {
          console.log('Reconnect failed:', reconnectError.message);
        }
        continue;
      }
      
      throw error;
    }
  }
};

// Middleware para log de conexões (apenas em desenvolvimento)
const connectionLogger = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.log(`🐌 Slow request: ${req.method} ${req.path} - ${duration}ms`);
      }
    });
  }
  
  next();
};

module.exports = {
  connectionLimiter,
  connectionLogger,
  safeQuery,
  dbQueue
};
