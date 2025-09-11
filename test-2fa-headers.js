const axios = require('axios')

// Teste de diferentes headers para 2FA
async function test2FAHeaders() {
  console.log('🔐 Testando diferentes headers para 2FA VRChat')
  console.log('══════════════════════════════════════════════════')
  
  const username = 'COLOQUE_SEU_EMAIL_AQUI'
  const password = 'COLOQUE_SUA_SENHA_AQUI'
  const twoFactorCode = 'COLOQUE_O_CODIGO_2FA_AQUI'
  
  if (username === 'COLOQUE_SEU_EMAIL_AQUI') {
    console.log('❌ Por favor, edite este arquivo e coloque suas credenciais reais')
    return
  }
  
  const credentials = Buffer.from(`${username}:${password}`).toString('base64')
  const baseURL = 'https://api.vrchat.cloud/api/1'
  
  // Configuração base do axios
  const axiosInstance = axios.create({
    baseURL,
    headers: {
      'User-Agent': 'VRCHIEVE/2.1.3 (Archive Nyo Integration)',
      'Content-Type': 'application/json'
    },
    timeout: 15000
  })
  
  const headerTests = [
    {
      name: 'X-MacaroonLogin (Atual)',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'X-MacaroonLogin': twoFactorCode
      }
    },
    {
      name: 'VRChat-2FA-Code (Atual)',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'VRChat-2FA-Code': twoFactorCode
      }
    },
    {
      name: 'emailOtp',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'emailOtp': twoFactorCode
      }
    },
    {
      name: 'X-VRChat-2FA',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'X-VRChat-2FA': twoFactorCode
      }
    },
    {
      name: 'Cookie com authcookie + emailOtp header',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'emailOtp': twoFactorCode,
        'Cookie': 'auth=temp'
      }
    },
    {
      name: 'POST com body (ao invés de GET)',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: {
        emailOtp: twoFactorCode
      }
    }
  ]
  
  for (let i = 0; i < headerTests.length; i++) {
    const test = headerTests[i]
    console.log(`\n📝 TESTE ${i + 1}: ${test.name}`)
    
    try {
      // Aguarda entre testes para evitar rate limiting
      if (i > 0) {
        console.log('⏳ Aguardando 20 segundos para evitar rate limiting...')
        await new Promise(resolve => setTimeout(resolve, 20000))
      }
      
      let response
      
      if (test.body) {
        // POST request
        response = await axiosInstance.post('/auth/user', test.body, {
          headers: test.headers
        })
      } else {
        // GET request
        response = await axiosInstance.get('/auth/user', {
          headers: test.headers
        })
      }
      
      console.log(`✅ Status: ${response.status}`)
      console.log(`📄 Data:`, JSON.stringify(response.data, null, 2))
      
      // Verifica se foi bem-sucedido
      if (response.data && !response.data.requiresTwoFactorAuth && response.data.id) {
        console.log('🎉 SUCESSO! Este header funcionou!')
        console.log('👤 User ID:', response.data.id)
        console.log('📧 Username:', response.data.username)
        break
      } else if (response.data && response.data.requiresTwoFactorAuth) {
        console.log('❌ Ainda requer 2FA - header não funcionou')
      }
      
    } catch (error) {
      console.log(`❌ Erro:`)
      console.log(`Status: ${error.response?.status || 'N/A'}`)
      console.log(`Data:`, JSON.stringify(error.response?.data || error.message, null, 2))
      
      if (error.response?.status === 429) {
        console.log('⚠️ Rate limited - aumentando delay para próximos testes')
        // Aguarda mais tempo se for rate limit
        await new Promise(resolve => setTimeout(resolve, 30000))
      }
    }
  }
  
  console.log('\n══════════════════════════════════════════════════')
  console.log('📋 CONCLUSÃO:')
  console.log('- Se nenhum teste funcionou, pode ser que:')
  console.log('  1. O código 2FA expirou (são válidos por poucos minutos)')
  console.log('  2. Precisa de um método diferente (cookie auth)')
  console.log('  3. A API mudou recentemente')
  console.log('- Tente com um código 2FA bem recente do email')
}

// Executa o teste
test2FAHeaders().catch(console.error)
