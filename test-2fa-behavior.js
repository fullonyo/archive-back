const axios = require('axios')

// Configuração da API VRChat
const VRCHAT_API_BASE = 'https://api.vrchat.cloud/api/1'

// Credenciais de teste
const username = 'maycombeta2@gmail.com'
const password = '@Nicolich122'

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

async function testVRChat2FA() {
  console.log('🔐 Teste específico de 2FA VRChat')
  console.log('═'.repeat(50))
  
  const credentials = Buffer.from(`${username}:${password}`).toString('base64')
  
  try {
    // Aguardar um pouco para evitar rate limiting
    console.log('⏳ Aguardando 3 segundos para evitar rate limiting...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Teste com código inválido para ver a diferença
    console.log('\n📝 TESTE 1: Código 2FA inválido (000000)')
    
    try {
      const response1 = await client.get('/auth/user', {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'VRChat-2FA-Code': '000000'
        }
      })
      
      console.log('✅ Status:', response1.status)
      console.log('📄 Data:', JSON.stringify(response1.data, null, 2))
      
    } catch (error1) {
      console.log('❌ Erro com código inválido:')
      console.log('Status:', error1.response?.status)
      console.log('Data:', JSON.stringify(error1.response?.data, null, 2))
    }
    
    // Aguardar antes do próximo teste
    console.log('\n⏳ Aguardando 5 segundos...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Teste sem código 2FA para comparar
    console.log('\n📝 TESTE 2: Sem código 2FA')
    
    try {
      const response2 = await client.get('/auth/user', {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      })
      
      console.log('✅ Status:', response2.status)
      console.log('📄 Data:', JSON.stringify(response2.data, null, 2))
      
    } catch (error2) {
      console.log('❌ Erro sem 2FA:')
      console.log('Status:', error2.response?.status)
      console.log('Data:', JSON.stringify(error2.response?.data, null, 2))
    }
    
    console.log('\n═'.repeat(50))
    console.log('📋 ANÁLISE:')
    console.log('- Se código inválido retorna status diferente = podemos detectar')
    console.log('- Se código inválido retorna mesmo status = problema na lógica')
    console.log('- Rate limiting indica muitas tentativas consecutivas')
    
    console.log('\n💡 RECOMENDAÇÕES:')
    console.log('1. Usar código 2FA mais recente do email')
    console.log('2. Aguardar pelo menos 30 segundos entre tentativas')
    console.log('3. Verificar se código não expirou (são válidos por poucos minutos)')
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message)
  }
}

// Executar teste
testVRChat2FA().catch(console.error)
