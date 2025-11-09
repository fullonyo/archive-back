const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Configurar dotenv
require('dotenv').config();

// Debug: verificar variáveis carregadas
console.log('Environment variables loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET ? '✓' : '✗',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ? '✓' : '✗',
  DATABASE_URL: process.env.DATABASE_URL ? '✓' : '✗',
  DB_HOST: process.env.DB_HOST ? '✓' : '✗'
});

// Importar configuração do Prisma
const { connectDB, setupConnectionHealth } = require('./config/prisma');
const { connectionLimiter, connectionLogger } = require('./middleware/connectionManager');
const authRoutes = require('./routes/auth');
const registerRoutes = require('./routes/register');
const passwordResetRoutes = require('./routes/passwordReset');
const userRoutes = require('./routes/users');
const assetRoutes = require('./routes/assets');
const categoryRoutes = require('./routes/categories');
const tagRoutes = require('./routes/tags');
const adminRoutes = require('./routes/admin');
const imageProxyRoutes = require('./routes/imageProxy');
const vrchatRoutes = require('./routes/vrchat');
const collectionRoutes = require('./routes/collections');
const errorHandler = require('./middleware/errorHandler');

// Importar novos serviços de cache e otimização
const AdvancedCacheService = require('./services/advancedCacheService');
const cdnService = require('./services/cdnService');

// Criar aplicação Express
const app = express();
const PORT = process.env.PORT || 3001;

// Configurar monitoramento de saúde das conexões
setupConnectionHealth();

// Cache warming inteligente (apenas dados essenciais)
setTimeout(async () => {
  try {
    console.log('🔥 Starting intelligent cache warming...');
    
    // Apenas cachear dados críticos sem sobrecarregar o DB
    // Cache apenas categorias (query leve)
    await AdvancedCacheService.getCachedCategories();
    console.log('✅ Essential cache warmed');
    
    // CDN cache será lazy-loaded quando necessário
    console.log('� Additional cache will be loaded on-demand');
    
  } catch (error) {
    console.log('⚠️  Cache warming skipped:', error.message);
  }
}, 10000); // 10 segundos após start para dar tempo da conexão estabilizar

console.log('📊 Database optimization: ✅ Enabled');

// Importar middlewares adicionais
const CacheHeadersMiddleware = require('./middleware/cacheHeaders');
const DatabaseOptimizationService = require('./services/databaseOptimizationService');
const redisCacheService = require('./services/redisCacheService');

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requisições sem origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173', // Vite dev server
      'http://localhost:5174',
      process.env.FRONTEND_URL,
      'https://arcllama.space'
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Connection management middleware
app.use(connectionLogger);
app.use(connectionLimiter);

// Body parsing middleware
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));
app.use(cookieParser());

// Compression middleware
app.use(compression());

// Cache headers middleware
app.use(CacheHeadersMiddleware.smartCache);
app.use(CacheHeadersMiddleware.conditionalGet);
app.use(CacheHeadersMiddleware.withETag);

// CDN route para servir imagens cached
app.get('/cdn/images/:filename', async (req, res) => {
  try {
    const assetId = req.params.filename.replace('.jpg', '');
    const localImage = await cdnService.serveLocalImage(assetId);
    
    if (localImage && localImage.cached) {
      // Headers de cache agressivo para imagens
      res.set({
        'Cache-Control': 'public, max-age=2592000, immutable', // 30 dias
        'Content-Type': 'image/jpeg'
      });
      
      return res.sendFile(path.resolve(localImage.path));
    }
    
    res.status(404).json({ error: 'Image not found in cache' });
  } catch (error) {
    res.status(500).json({ error: 'Error serving cached image' });
  }
});

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'development' ? 50000 : 2000, // 50k para dev, 2000 para prod (10x mais)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Pular rate limiting para rotas de assets em desenvolvimento
    if (process.env.NODE_ENV === 'development' && req.path.startsWith('/api/assets')) {
      return true;
    }
    return false;
  }
});
app.use(limiter);

// Upload rate limiting
const uploadLimiter = rateLimit({
  windowMs: parseInt(process.env.UPLOAD_RATE_WINDOW) * 60 * 1000 || 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 500 : (parseInt(process.env.UPLOAD_RATE_LIMIT) || 10),
  message: 'Too many uploads from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting específico para leitura de assets (mais permissivo)
const assetsReadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: process.env.NODE_ENV === 'development' ? 10000 : 500, // 500 requests por minuto em prod
  message: 'Too many asset requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/register', registerRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assets', assetsReadLimiter, assetRoutes); // Rate limiting mais permissivo para leitura
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/proxy', imageProxyRoutes);
app.use('/api/vrchat', vrchatRoutes);
app.use('/api/collections', collectionRoutes);

// Health check endpoint (melhorado para Docker)
app.get('/api/health', async (req, res) => {
  try {
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    };

    // Verificar conexão com Redis
    try {
      const redisHealth = await redisCacheService.healthCheck();
      health.redis = redisHealth;
    } catch (error) {
      health.redis = { status: 'error', message: error.message };
    }

    // Verificar conexão com database
    try {
      await connectDB();
      health.database = { status: 'connected' };
    } catch (error) {
      health.database = { status: 'error', message: error.message };
      return res.status(503).json(health);
    }

    res.status(200).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check simples para Docker (sem autenticação)
app.get('/health', async (req, res) => {
  try {
    // Check básico de conectividade
    await connectDB();
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'error', message: error.message });
  }
});

// Cache stats endpoint
app.get('/api/cache/stats', async (req, res) => {
  try {
    const cacheStats = await AdvancedCacheService.getCacheStats();
    const cdnStats = await cdnService.getCacheStats();
    const redisHealth = await redisCacheService.healthCheck();
    
    res.json({
      cache: cacheStats,
      cdn: cdnStats,
      redis: redisHealth,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching cache stats' });
  }
});

// Cache management endpoints
app.post('/api/cache/invalidate/assets', async (req, res) => {
  await AdvancedCacheService.invalidateAssetsCaches();
  res.json({ message: 'Assets cache invalidated' });
});

app.post('/api/cache/invalidate/categories', async (req, res) => {
  await AdvancedCacheService.invalidateCategoriesCache();
  res.json({ message: 'Categories cache invalidated' });
});

app.post('/api/cache/warmup', async (req, res) => {
  try {
    await AdvancedCacheService.warmUpCache();
    res.json({ message: 'Cache warmed up successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error warming up cache' });
  }
});

// Redis health check endpoint
app.get('/api/redis/health', async (req, res) => {
  try {
    const health = await redisCacheService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: 'Error checking Redis health' });
  }
});

// Redis flush endpoint (admin only)
app.post('/api/redis/flush', async (req, res) => {
  try {
    await redisCacheService.flushAll();
    res.json({ message: 'Redis cache flushed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error flushing Redis cache' });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Increase timeout for large file uploads (30 minutes)
server.timeout = 1800000; // 30 minutes
server.keepAliveTimeout = 1810000; // Slightly longer than timeout
server.headersTimeout = 1820000; // Slightly longer than keepAliveTimeout

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  
  // Fechar servidor
  server.close(async () => {
    console.log('🔌 HTTP server closed');
    
    // Fechar conexão Redis
    await redisCacheService.disconnect();
    
    // Fechar conexão Prisma se necessário
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  
  server.close(async () => {
    console.log('🔌 HTTP server closed');
    await redisCacheService.disconnect();
    process.exit(0);
  });
});

module.exports = app; 