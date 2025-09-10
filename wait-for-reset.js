// Script para aguardar reset do limite de conexões MySQL
const { connectDB } = require('./config/prisma');

async function waitForReset() {
  console.log('🕐 Aguardando reset do limite de conexões MySQL...');
  console.log('⏰ O limite de 500 conexões/hora será resetado em breve');
  console.log('💡 Enquanto isso, as configurações foram otimizadas:');
  console.log('   - connection_limit: 2 (era 5)');
  console.log('   - Cache warming: DESABILITADO');
  console.log('   - Query middleware: DESABILITADO');
  console.log('   - Connection cleanup: DESABILITADO');
  
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    try {
      console.log(`\n🔄 Tentativa ${attempts + 1}/${maxAttempts} de conectar...`);
      await connectDB();
      console.log('✅ Conexão estabelecida com sucesso!');
      console.log('🚀 Agora você pode executar: npm run dev');
      break;
    } catch (error) {
      attempts++;
      if (error.message.includes('max_connections_per_hour')) {
        console.log(`❌ Ainda no limite. Aguardando 2 minutos...`);
        await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutos
      } else {
        console.log(`❌ Erro diferente: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 segundos
      }
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log('❌ Não foi possível conectar após todas as tentativas');
    console.log('💡 Tente novamente em alguns minutos ou aguarde o reset da hora');
  }
}

waitForReset().catch(console.error);
