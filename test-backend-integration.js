const axios = require('axios')

// Teste integrado do endpoint VRChat do backend
async function testBackendVRChat() {
  console.log('🧪 Teste Integrado VRChat Backend + Auth')
  console.log('═══════════════════════════════════════════════')
  
  const backendURL = 'http://localhost:5000'
  
  try {
    // Primeiro, fazer login como usuário para obter token
    console.log('📝 PASSO 1: Login no backend para obter token')
    
    const loginResponse = await axios.post(`${backendURL}/api/auth/login`, {
      email: 'admin@archieve.com', // usuário de teste
      password: 'admin123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!loginResponse.data.success) {
      console.log('❌ Falha no login:', loginResponse.data)
      return
    }
    
    const accessToken = loginResponse.data.data.accessToken
    console.log('✅ Login realizado com sucesso')
    console.log('🔑 Token obtido:', accessToken.substring(0, 20) + '...')
    
    // Aguarda um pouco
    console.log('⏳ Aguardando 2 segundos...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('\n📝 PASSO 2: Teste conexão VRChat com token')
    
    const vrchatResponse = await axios.post(`${backendURL}/api/vrchat/connect`, {
      username: 'maycombeta2@gmail.com',
      password: '@Nicolich122',
      twoFactorAuth: '756742' // código mais recente
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    console.log('✅ Resposta VRChat Backend:', JSON.stringify(vrchatResponse.data, null, 2))
    
    if (vrchatResponse.data.success) {
      console.log('🎉 SUCESSO COMPLETO! VRChat integrado ao backend!')
      console.log('👤 VRChat User:', vrchatResponse.data.data.vrchatUser.displayName)
      console.log('🆔 VRChat ID:', vrchatResponse.data.data.vrchatUser.id)
    }
    
  } catch (error) {
    console.log('❌ Erro no teste integrado:')
    console.log(`Status: ${error.response?.status || 'N/A'}`)
    console.log(`Data:`, JSON.stringify(error.response?.data || error.message, null, 2))
    
    // Se for erro de login, tenta com credenciais alternativas
    if (error.response?.status === 401 && !error.config.url.includes('/vrchat/')) {
      console.log('\n📝 TENTATIVA 2: Testando com usuário sistema')
      
      try {
        const systemLoginResponse = await axios.post(`${backendURL}/api/auth/login`, {
          email: 'sistema@vrchieve.com',
          password: 'sistema123'
        })
        
        if (systemLoginResponse.data.success) {
          const systemToken = systemLoginResponse.data.data.accessToken
          console.log('✅ Login sistema realizado')
          
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          const vrchatResponse = await axios.post(`${backendURL}/api/vrchat/connect`, {
            username: 'maycombeta2@gmail.com',
            password: '@Nicolich122',
            twoFactorAuth: '756742'
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${systemToken}`
            }
          })
          
          console.log('✅ Resposta VRChat com usuário sistema:', JSON.stringify(vrchatResponse.data, null, 2))
        }
        
      } catch (systemError) {
        console.log('❌ Erro com usuário sistema:', systemError.response?.data || systemError.message)
      }
    }
  }
}

// Executa o teste
testBackendVRChat().catch(console.error)
