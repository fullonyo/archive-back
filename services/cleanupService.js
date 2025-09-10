const cron = require('node-cron');
const registrationService = require('../services/registrationService');

// Executar limpeza todos os dias às 2:00 AM
cron.schedule('0 2 * * *', async () => {
  console.log('🧹 Iniciando limpeza de registros expirados...');
  
  try {
    const cleaned = await registrationService.cleanupExpiredRegistrations();
    console.log(`✅ Limpeza concluída: ${cleaned} registros removidos`);
  } catch (error) {
    console.error('❌ Erro na limpeza automática:', error);
  }
});

// Executar na inicialização também
setTimeout(async () => {
  try {
    const cleaned = await registrationService.cleanupExpiredRegistrations();
    console.log(`🧹 Limpeza inicial: ${cleaned} registros expirados removidos`);
  } catch (error) {
    console.error('❌ Erro na limpeza inicial:', error);
  }
}, 10000); // 10 segundos após inicialização

module.exports = {};
