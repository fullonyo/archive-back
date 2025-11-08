require('dotenv').config();
const emailService = require('../services/emailService');

async function testEmail() {
  console.log('\n🧪 Testando serviço de email...\n');
  
  console.log('📋 Configurações:');
  console.log(`  EMAIL_HOST: ${process.env.EMAIL_HOST}`);
  console.log(`  EMAIL_PORT: ${process.env.EMAIL_PORT}`);
  console.log(`  EMAIL_USER: ${process.env.EMAIL_USER}`);
  console.log(`  EMAIL_PASS: ${process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'não configurado'}`);
  console.log(`  EMAIL_FROM: ${process.env.EMAIL_FROM}`);
  console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`  FRONTEND_URL: ${process.env.FRONTEND_URL}\n`);

  const testEmail = 'teste@example.com';
  const testNickname = 'Usuário Teste';
  const testToken = 'test-token-123456789';

  try {
    console.log('📧 Enviando email de teste...\n');
    await emailService.sendConfirmationEmail(testEmail, testNickname, testToken);
    console.log('\n✅ Email enviado com sucesso!');
  } catch (error) {
    console.error('\n❌ Erro ao enviar email:');
    console.error('Tipo:', error.name);
    console.error('Mensagem:', error.message);
    
    if (error.code) {
      console.error('Código:', error.code);
    }
    
    if (error.response) {
      console.error('Resposta SMTP:', error.response);
    }
    
    if (error.responseCode) {
      console.error('Código de resposta:', error.responseCode);
    }
    
    console.error('\n📝 Dicas para resolver:');
    
    if (error.code === 'EAUTH') {
      console.error('  • Verifique se EMAIL_USER e EMAIL_PASS estão corretos');
      console.error('  • Se usando Gmail, ative "Acesso a app menos seguro" ou use "Senha de app"');
      console.error('  • Link: https://myaccount.google.com/apppasswords');
    }
    
    if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error('  • Verifique sua conexão com a internet');
      console.error('  • Verifique se EMAIL_HOST e EMAIL_PORT estão corretos');
      console.error('  • Seu firewall pode estar bloqueando a porta 587');
    }
    
    if (error.responseCode === 535) {
      console.error('  • Credenciais inválidas');
      console.error('  • Para Gmail, use uma "Senha de app" ao invés da senha normal');
    }
    
    process.exit(1);
  }
}

testEmail();
