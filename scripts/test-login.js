const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testLogin() {
  console.log('🧪 Testando login...\n');

  try {
    const credentials = {
      username: 'mayco_dev',
      password: 'Test123!'
    };

    console.log('📤 Enviando credenciais:', credentials);
    console.log('🌐 URL:', `${API_URL}/auth/login`);
    console.log('');

    const response = await axios.post(`${API_URL}/auth/login`, credentials, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Login bem-sucedido!\n');
    console.log('📊 Response Status:', response.status);
    console.log('📦 Response Data:', JSON.stringify(response.data, null, 2));
    console.log('');

    if (response.data.success) {
      console.log('🔑 Token recebido:', response.data.data.token?.substring(0, 50) + '...');
      console.log('👤 Username:', response.data.data.user.username);
      console.log('📧 Email:', response.data.data.user.email);
      console.log('🎭 Role:', response.data.data.user.role);
      console.log('');
      console.log('🎉 Tudo funcionando corretamente!');
    } else {
      console.log('❌ Success: false - Algo deu errado');
    }

  } catch (error) {
    console.error('❌ Erro no login!\n');

    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📦 Response:', JSON.stringify(error.response.data, null, 2));
      console.error('');

      if (error.response.status === 401) {
        console.error('🔒 Credenciais inválidas');
        console.error('   - Verifique username: mayco_dev');
        console.error('   - Verifique password: Test123!');
        console.error('   - Verifique se usuário existe no banco');
      } else if (error.response.status === 400) {
        console.error('📝 Erro de validação');
        console.error('   - Backend pode não ter sido reiniciado');
        console.error('   - Validação de username pode estar incorreta');
        console.error('   - Execute: cd archive-back && npm run dev');
      }
    } else if (error.request) {
      console.error('🌐 Erro de rede');
      console.error('   - Backend não está rodando?');
      console.error('   - Verifique se está na porta 3001');
      console.error('   - Execute: cd archive-back && npm run dev');
    } else {
      console.error('💥 Erro desconhecido:', error.message);
    }

    process.exit(1);
  }
}

// Executar teste
if (require.main === module) {
  console.log('═══════════════════════════════════════════════');
  console.log('  🔐 Teste de Login - Archive Nyo');
  console.log('═══════════════════════════════════════════════\n');

  testLogin()
    .then(() => {
      console.log('\n═══════════════════════════════════════════════');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Teste falhou:', error.message);
      console.log('═══════════════════════════════════════════════');
      process.exit(1);
    });
}

module.exports = testLogin;
