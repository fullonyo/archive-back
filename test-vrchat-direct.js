const axios = require('axios')

// Configuração da API VRChat
const VRCHAT_API_BASE = 'https://api.vrchat.cloud/api/1'

// Credenciais de teste
const username = 'maycombeta2@gmail.com'
const password = '@Nicolich122'
const twoFactorCode = '642240'

// Cliente HTTP configurado
const client = axios.create({
  baseURL: VRCHAT_API_BASE,
  timeout: 30000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'VRCHIEVE/1.0 (https://vrchieve.com)'
  }
})

async function testVRChatAPI() {
  console.log('🔗 Iniciando teste direto da API VRChat...')
  console.log('═'.repeat(60))
  
  try {
    // Teste 1: Tentativa inicial de login
    console.log('\n📝 TESTE 1: Login inicial (sem 2FA)')
    console.log('Username:', username)
    console.log('Password:', password.replace(/./g, '*'))
    
    const credentials = Buffer.from(`${username}:${password}`).toString('base64')
    
    const response1 = await client.get('/auth/user', {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    })
    
    console.log('✅ Status:', response1.status)
    console.log('📋 Headers importantes:', {
      'set-cookie': response1.headers['set-cookie'],
      'x-vrc-api-version': response1.headers['x-vrc-api-version'],
      'x-vrc-api-group': response1.headers['x-vrc-api-group']
    })
    console.log('📄 Response Data:', JSON.stringify(response1.data, null, 2))
    
    // Se chegou até aqui, verificar se precisa de 2FA
    if (response1.data.requiresTwoFactorAuth) {
      console.log('\n🔐 2FA detectado! Tipos:', response1.data.requiresTwoFactorAuth)
      
      // Teste 2: Login com 2FA
      console.log('\n📝 TESTE 2: Login com 2FA')
      console.log('Código 2FA:', twoFactorCode)
      
      const response2 = await client.get('/auth/user', {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'VRChat-2FA-Code': twoFactorCode
        }
      })
      
      console.log('✅ Status com 2FA:', response2.status)
      console.log('📋 Headers com 2FA:', {
        'set-cookie': response2.headers['set-cookie'],
        'x-vrc-api-version': response2.headers['x-vrc-api-version']
      })
      console.log('📄 Response Data com 2FA:', JSON.stringify(response2.data, null, 2))
      
      if (response2.data.id) {
        console.log('\n🎉 SUCESSO! Usuário autenticado:')
        console.log('- ID:', response2.data.id)
        console.log('- Username:', response2.data.username)
        console.log('- Display Name:', response2.data.displayName)
        console.log('- Status:', response2.data.status)
        console.log('- Avatar URL:', response2.data.currentAvatarImageUrl)
      }
    } else if (response1.data.id) {
      console.log('\n🎉 SUCESSO! Login sem 2FA:')
      console.log('- ID:', response1.data.id)
      console.log('- Username:', response1.data.username)
      console.log('- Display Name:', response1.data.displayName)
    }
    
  } catch (error) {
    console.log('\n❌ ERRO capturado:')
    console.log('Status:', error.response?.status)
    console.log('Status Text:', error.response?.statusText)
    console.log('Headers:', error.response?.headers)
    console.log('Data:', JSON.stringify(error.response?.data, null, 2))
    
    // Se for 401, pode ser 2FA necessário
    if (error.response?.status === 401) {
      console.log('\n🔐 Status 401 - Verificando se é 2FA...')
      
      const errorData = error.response.data
      if (errorData?.requiresTwoFactorAuth) {
        console.log('✅ 2FA detectado no erro! Tipos:', errorData.requiresTwoFactorAuth)
        
        // Teste com 2FA após erro 401
        console.log('\n📝 TESTE 3: Login com 2FA após 401')
        try {
          const response3 = await client.get('/auth/user', {
            headers: {
              'Authorization': `Basic ${credentials}`,
              'VRChat-2FA-Code': twoFactorCode
            }
          })
          
          console.log('✅ Status com 2FA após 401:', response3.status)
          console.log('📄 Data com 2FA:', JSON.stringify(response3.data, null, 2))
          
        } catch (error2FA) {
          console.log('❌ Erro no 2FA:')
          console.log('Status:', error2FA.response?.status)
          console.log('Data:', JSON.stringify(error2FA.response?.data, null, 2))
        }
      }
    }
    
    // Se for 429, é rate limiting
    if (error.response?.status === 429) {
      console.log('\n⏳ Rate limiting detectado!')
      console.log('Retry-After:', error.response.headers['retry-after'])
      console.log('Message:', error.response.data?.message)
    }
  }
  
  console.log('\n═'.repeat(60))
  console.log('🏁 Teste concluído!')
}

// Executar teste
testVRChatAPI().catch(console.error)
