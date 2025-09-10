// Servidor mínimo para quando o limite de conexões for resetado
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/prisma');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware básico
app.use(cors());
app.use(express.json());

// Rota de status simples (sem database)
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'Server running', 
    message: 'Aguardando reset do limite de conexões MySQL',
    timestamp: new Date().toISOString() 
  });
});

// Rota para testar conexão
app.get('/api/test-db', async (req, res) => {
  try {
    await connectDB();
    res.json({ 
      success: true, 
      message: 'Database connection successful!' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      isConnectionLimit: error.message.includes('max_connections_per_hour')
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Servidor mínimo rodando na porta ${PORT}`);
  console.log(`📊 Status: http://localhost:${PORT}/api/status`);
  console.log(`🔍 Test DB: http://localhost:${PORT}/api/test-db`);
  console.log('⚠️  Aguardando reset do limite de conexões para carregar rotas completas');
});
