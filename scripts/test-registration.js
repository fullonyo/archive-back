require('dotenv').config();
const registrationService = require('../services/registrationService');

async function testRegistration() {
  console.log('\n🧪 Testando fluxo completo de registro...\n');

  const testData = {
    username: 'testuser123',
    email: 'maycombeta4@gmail.com', // Email real do teste
    password: 'Senha123!'
  };

  try {
    console.log('📝 Criando registro pendente...');
    console.log(`  Email: ${testData.email}`);
    console.log(`  Username: ${testData.username}\n`);

    const result = await registrationService.createPendingRegistration({
      nickname: testData.username,
      email: testData.email,
      discord: null,
      password: testData.password
    });

    console.log('\n✅ Registro criado com sucesso!');
    console.log('Resultado:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    
    if (error.message.includes('aguardando confirmação')) {
      console.log('\n📌 Email já possui registro pendente. Testando atualização...\n');
      
      try {
        const updateResult = await registrationService.handlePendingRegistration(
          testData.email,
          {
            nickname: testData.username,
            discord: null,
            password: testData.password
          }
        );
        
        console.log('\n✅ Registro atualizado com sucesso!');
        console.log('Resultado:', JSON.stringify(updateResult, null, 2));
      } catch (updateError) {
        console.error('\n❌ Erro ao atualizar:', updateError.message);
      }
    }
  }
}

testRegistration().then(() => {
  console.log('\n✅ Teste finalizado!\n');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Erro fatal:', err);
  process.exit(1);
});
