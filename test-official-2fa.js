const axios = require('axios')

// Teste baseado na documentação não oficial do VRChat
async function testOfficialMethod() {
  console.log('🔐 Teste baseado na documentação VRChat')
  console.log('══════════════════════════════════════════════════')
  
  const username = 'maycombeta2@gmail.com'
  const password = '@Nicolich122'
  const twoFactorCode = '171653'
  
  if (username === 'COLOQUE_SEU_EMAIL_AQUI') {
    console.log('❌ Por favor, edite este arquivo e coloque suas credenciais reais')
    return
  }
  
  const credentials = Buffer.from(`${username}:${password}`).toString('base64')
  const baseURL = 'https://api.vrchat.cloud/api/1'
  
  try {
    console.log('📝 PASSO 1: Login inicial (para detectar 2FA)')
    
    const initialResponse = await axios.get(`${baseURL}/auth/user`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'VRCHIEVE/2.1.3 (Archive Nyo Integration)',
        'Content-Type': 'application/json'
      }
    })
    
    console.log('✅ Resposta inicial:', JSON.stringify(initialResponse.data, null, 2))
    
    if (initialResponse.data.requiresTwoFactorAuth) {
      console.log('🔐 2FA detectado:', initialResponse.data.requiresTwoFactorAuth)
      
      // Aguarda um pouco
      console.log('⏳ Aguardando 5 segundos...')
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      console.log('\n📝 PASSO 2: Enviando código 2FA via POST')
      
      // Método POST com código no body (método alternativo)
      const twoFAResponse = await axios.post(`${baseURL}/auth/twofactorauth/emailotp/verify`, {
        code: twoFactorCode
      }, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'User-Agent': 'VRCHIEVE/2.1.3 (Archive Nyo Integration)',
          'Content-Type': 'application/json'
        }
      })
      
      console.log('✅ Resposta 2FA POST:', JSON.stringify(twoFAResponse.data, null, 2))
      
      // Aguarda um pouco
      console.log('⏳ Aguardando 3 segundos...')
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      console.log('\n📝 PASSO 3: Tentando login novamente após verificação')
      
      const finalResponse = await axios.get(`${baseURL}/auth/user`, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'User-Agent': 'VRCHIEVE/2.1.3 (Archive Nyo Integration)',
          'Content-Type': 'application/json'
        }
      })
      
      console.log('✅ Resposta final:', JSON.stringify(finalResponse.data, null, 2))
      
      if (finalResponse.data.id) {
        console.log('🎉 SUCESSO! Login completado com 2FA!')
        console.log('👤 User ID:', finalResponse.data.id)
        console.log('📧 Username:', finalResponse.data.username)
      } else {
        console.log('❌ Ainda não funcionou - pode precisar de cookie management')
      }
    }
    
  } catch (error) {
    console.log(`❌ Erro:`)
    console.log(`Status: ${error.response?.status || 'N/A'}`)
    console.log(`URL: ${error.config?.url || 'N/A'}`)
    console.log(`Data:`, JSON.stringify(error.response?.data || error.message, null, 2))
  }
}

// Executa o teste
testOfficialMethod().catch(console.error)
