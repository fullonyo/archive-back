require('dotenv').config();
const nodemailer = require('nodemailer');

async function sendTestEmail() {
  console.log('\n📧 Enviando email de teste direto...\n');

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
    to: 'maycombeta4@gmail.com',
    subject: 'Teste - Email Direto do Sistema',
    text: 'Este é um email de teste enviado diretamente sem HTML.',
    html: `
      <h1>Email de Teste</h1>
      <p>Se você está vendo isso, o sistema de email está funcionando perfeitamente!</p>
      <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    `
  };

  try {
    console.log('Configurações:');
    console.log(`  De: ${mailOptions.from}`);
    console.log(`  Para: ${mailOptions.to}`);
    console.log(`  Assunto: ${mailOptions.subject}`);
    console.log(`  SMTP: ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}\n`);

    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email enviado com sucesso!');
    console.log(`📨 Message ID: ${info.messageId}`);
    console.log(`📬 Aceito: ${info.accepted}`);
    console.log(`❌ Rejeitado: ${info.rejected}`);
    
    console.log('\n📋 Verificar:');
    console.log('  1. Caixa de entrada de maycombeta4@gmail.com');
    console.log('  2. Pasta de SPAM');
    console.log('  3. Pasta de Promoções (Gmail)');
    console.log('  4. Pasta Social (Gmail)\n');

  } catch (error) {
    console.error('❌ Erro ao enviar:', error);
    console.error('\nDetalhes:', {
      code: error.code,
      command: error.command,
      response: error.response
    });
  }
}

sendTestEmail();
