const axios = require('axios')

// Teste com cookies de autenticação
async function testCookieAuth() {
  console.log('🔐 Teste com Cookies de Autenticação VRChat')
  console.log('══════════════════════════════════════════════════')
  
  const username = 'maycombeta2@gmail.com'
  const password = '@Nicolich122'
  const twoFactorCode = '727240' // Substitua pelo código mais recente do email
  
  const credentials = Buffer.from(`${username}:${password}`).toString('base64')
  const baseURL = 'https://api.vrchat.cloud/api/1'
  
  try {
    console.log('📝 PASSO 1: Login inicial (para obter cookie)')
    
    const initialResponse = await axios.get(`${baseURL}/auth/user`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'VRCHIEVE/2.1.3 (Archive Nyo Integration)',
        'Content-Type': 'application/json'
      }
    })
    
    console.log('✅ Resposta inicial:', JSON.stringify(initialResponse.data, null, 2))
    
    // Extrai cookie da resposta
    const setCookieHeader = initialResponse.headers['set-cookie']
    console.log('🍪 Set-Cookie headers:', setCookieHeader)
    
    let authCookie = null
    if (setCookieHeader) {
      const authCookieMatch = setCookieHeader.find(cookie => cookie.startsWith('auth='))
      if (authCookieMatch) {
        authCookie = authCookieMatch.split(';')[0] // Pega só a parte "auth=valor"
        console.log('🍪 Cookie extraído:', authCookie)
      }
    }
    
    if (initialResponse.data.requiresTwoFactorAuth && authCookie) {
      console.log('🔐 2FA detectado:', initialResponse.data.requiresTwoFactorAuth)
      
      // Aguarda um pouco
      console.log('⏳ Aguardando 3 segundos...')
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      console.log('\n📝 PASSO 2: Enviando código 2FA com cookie')
      
      // Tenta endpoint de verificação com cookie
      try {
        const twoFAResponse = await axios.post(`${baseURL}/auth/twofactorauth/emailotp/verify`, {
          code: twoFactorCode
        }, {
          headers: {
            'User-Agent': 'VRCHIEVE/2.1.3 (Archive Nyo Integration)',
            'Content-Type': 'application/json',
            'Cookie': authCookie
          }
        })
        
        console.log('✅ Resposta 2FA POST com cookie:', JSON.stringify(twoFAResponse.data, null, 2))
        
        // Aguarda um pouco
        console.log('⏳ Aguardando 3 segundos...')
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        console.log('\n📝 PASSO 3: Verificando login após 2FA')
        
        const finalResponse = await axios.get(`${baseURL}/auth/user`, {
          headers: {
            'User-Agent': 'VRCHIEVE/2.1.3 (Archive Nyo Integration)',
            'Content-Type': 'application/json',
            'Cookie': authCookie
          }
        })
        
        console.log('✅ Resposta final com cookie:', JSON.stringify(finalResponse.data, null, 2))
        
        if (finalResponse.data.id) {
          console.log('🎉 SUCESSO! Login completado com 2FA + Cookie!')
          console.log('👤 User ID:', finalResponse.data.id)
          console.log('📧 Username:', finalResponse.data.username)
        } else {
          console.log('❌ Ainda não funcionou com cookie')
        }
        
      } catch (cookieError) {
        console.log('❌ Erro com cookie method:')
        console.log(`Status: ${cookieError.response?.status || 'N/A'}`)
        console.log(`Data:`, JSON.stringify(cookieError.response?.data || cookieError.message, null, 2))
        
        // Tenta método alternativo: usar cookie no GET com headers de 2FA
        console.log('\n📝 PASSO 2B: Tentando GET com cookie + headers 2FA')
        
        try {
          const altResponse = await axios.get(`${baseURL}/auth/user`, {
            headers: {
              'User-Agent': 'VRCHIEVE/2.1.3 (Archive Nyo Integration)',
              'Content-Type': 'application/json',
              'Cookie': authCookie,
              'emailOtp': twoFactorCode,
              'X-MacaroonLogin': twoFactorCode
            }
          })
          
          console.log('✅ Resposta alternativa:', JSON.stringify(altResponse.data, null, 2))
          
          if (altResponse.data.id) {
            console.log('🎉 SUCESSO! Método alternativo funcionou!')
            console.log('👤 User ID:', altResponse.data.id)
            console.log('📧 Username:', altResponse.data.username)
          }
          
        } catch (altError) {
          console.log('❌ Método alternativo também falhou:')
          console.log(`Status: ${altError.response?.status || 'N/A'}`)
          console.log(`Data:`, JSON.stringify(altError.response?.data || altError.message, null, 2))
        }
      }
    } else {
      console.log('❌ Não foi possível obter cookie ou 2FA não detectado')
    }
    
  } catch (error) {
    console.log(`❌ Erro inicial:`)
    console.log(`Status: ${error.response?.status || 'N/A'}`)
    console.log(`Data:`, JSON.stringify(error.response?.data || error.message, null, 2))
  }
}

// Executa o teste
testCookieAuth().catch(console.error)
