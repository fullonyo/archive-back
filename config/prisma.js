const { PrismaClient } = require('@prisma/client');

// Global instance to avoid connection issues
let prisma;

// Configuração otimizada para reduzir conexões sem impactar performance
const createPrismaClient = (isProduction = false) => {
  const baseConfig = {
    log: isProduction ? ['error'] : ['error', 'warn'],
    errorFormat: isProduction ? 'minimal' : 'pretty',
    datasources: {
      db: {
        url: isProduction 
          ? process.env.DATABASE_URL
          : process.env.DATABASE_URL + '?connection_limit=3&pool_timeout=60&socket_timeout=30&connect_timeout=30'
      }
    }
  };

  return new PrismaClient(baseConfig);
};

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient(true);
} else {
  // Development mode with optimized connection pooling
  if (!global.prisma) {
    global.prisma = createPrismaClient(false);
  }
  prisma = global.prisma;
}

// Middleware otimizado para monitoramento (sem overhead)
if (prisma && typeof prisma.$use === 'function') {
  prisma.$use(async (params, next) => {
    try {
      const result = await next(params);
      return result;
    } catch (error) {
      // Log apenas erros críticos
      if (error.code === 'P2002' || error.code === 'P2025' || error.message.includes('max_connections')) {
        console.error(`� DB Error [${params.model}.${params.action}]:`, error.message);
      }
      throw error;
    }
  });
}

// Connect to database with intelligent retry logic
const connectDB = async (retries = 5) => {
  try {
    await prisma.$connect();
    console.log('✅ Prisma Connected successfully to MySQL');
    
    // Verificar saúde da conexão
    await prisma.$queryRaw`SELECT 1 as health`;
    console.log('💚 Database health check passed');
    
  } catch (error) {
    console.error('❌ Prisma connection failed:', error.message);
    
    // Diferentes estratégias baseadas no tipo de erro
    if (error.message.includes('max_connections_per_hour')) {
      if (retries > 0) {
        console.log(`� Connection limit exceeded. Waiting 2 minutes... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutos
        return connectDB(retries - 1);
      }
    } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      if (retries > 0) {
        console.log(`⏱️  Connection timeout. Retrying in 10 seconds... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        return connectDB(retries - 1);
      }
    } else if (retries > 0) {
      console.log(`🔄 Generic error. Retrying in 5 seconds... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDB(retries - 1);
    }
    
    console.error('❌ Failed to connect after all retries');
    
    // Em desenvolvimento, não sair do processo
    if (process.env.NODE_ENV !== 'production') {
      console.log('⚠️  Development mode: Server will continue without database');
      return;
    }
    
    process.exit(1);
  }
};

// Disconnect from database
const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log('🔌 Prisma disconnected from database');
  } catch (error) {
    console.error('❌ Error disconnecting from database:', error.message);
  }
};

// Função para manter conexões saudáveis sem sobrecarregar
const setupConnectionHealth = () => {
  if (process.env.NODE_ENV !== 'production') {
    // Health check leve a cada 10 minutos
    setInterval(async () => {
      try {
        await prisma.$queryRaw`SELECT 1 as health`;
        // Sucesso silencioso - sem log desnecessário
      } catch (error) {
        console.error('🏥 Database health check failed:', error.message);
        
        // Tentar reconectar apenas se necessário
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          console.log('🔄 Attempting to reconnect...');
          try {
            await prisma.$disconnect();
            await prisma.$connect();
            console.log('✅ Reconnection successful');
          } catch (reconnectError) {
            console.error('❌ Reconnection failed:', reconnectError.message);
          }
        }
      }
    }, 10 * 60 * 1000); // 10 minutos
    
    console.log('💚 Database health monitoring enabled (10-minute intervals)');
  }
};

// Graceful shutdown otimizado
const gracefulShutdown = async (signal) => {
  console.log(`\n📡 Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Aguardar queries pendentes finalizarem (max 5 segundos)
    const shutdownPromise = disconnectDB();
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 5000));
    
    await Promise.race([shutdownPromise, timeoutPromise]);
    console.log('✅ Graceful shutdown completed');
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Capturar erros não tratados
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = {
  prisma,
  connectDB,
  disconnectDB,
  setupConnectionHealth
};
