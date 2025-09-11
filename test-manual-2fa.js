const axios = require('axios')

// Script para teste manual com código 2FA real
async function testManual2FA() {
  console.log('🔐 Teste Manual VRChat 2FA')
  console.log('══════════════════════════════════════')
  
  const username = 'NyoArchive'
  const password = 'J82dZIWTK5VnJYrPU65T4pQAX3tVz9Dm'
  
  // Pede o código 2FA do usuário
  console.log('\n📧 Agora vá ao seu email e pegue o código de verificação do VRChat')
  console.log('⏳ Digite o código de 6 dígitos quando estiver pronto...')
  
  // Simula input do usuário (você precisará inserir o código manualmente no console)
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  const twoFactorCode = await new Promise((resolve) => {
    rl.question('Código 2FA: ', (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
  
  console.log(`\n🔑 Testando com código: ${twoFactorCode}`)
  console.log('⏳ Fazendo request para VRChat API...\n')
  
  try {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64')
    
    const response = await axios.get('https://api.vrchat.cloud/api/1/auth/user', {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'X-MacaroonLogin': twoFactorCode,
        'VRChat-2FA-Code': twoFactorCode,
        'User-Agent': 'VRCHIEVE/2.1.3 (Archive Nyo Integration)',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    })
    
    console.log('✅ SUCESSO!')
    console.log('Status:', response.status)
    console.log('User:', response.data.displayName)
    console.log('ID:', response.data.id)
    console.log('Data completa:', JSON.stringify(response.data, null, 2))
    
  } catch (error) {
    console.log('❌ ERRO!')
    console.log('Status:', error.response?.status)
    console.log('Message:', error.response?.data?.error?.message || error.message)
    
    if (error.response?.data) {
      console.log('Response data:', JSON.stringify(error.response.data, null, 2))
      
      // Analisa o tipo de erro
      if (error.response.data.requiresTwoFactorAuth) {
        console.log('\n🔍 ANÁLISE: API ainda pede 2FA - código pode estar inválido/expirado')
      } else if (error.response.status === 429) {
        console.log('\n🔍 ANÁLISE: Rate limiting - muitas tentativas')
      } else if (error.response.status === 401) {
        console.log('\n🔍 ANÁLISE: Credenciais inválidas')
      }
    }
  }
}

testManual2FA().catch(console.error)
