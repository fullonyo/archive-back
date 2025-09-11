const axios = require('axios')

// Teste direto da rota VRChat do backend
async function testVRChatRoute() {
  console.log('🧪 Teste da Rota VRChat Backend')
  console.log('═══════════════════════════════════════')
  
  const baseURL = 'http://localhost:5000'
  
  try {
    console.log('📝 PASSO 1: Teste sem autenticação (deve dar 401)')
    
    const response = await axios.post(`${baseURL}/api/vrchat/connect`, {
      username: 'maycombeta2@gmail.com',
      password: '@Nicolich122'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    console.log('✅ Resposta inesperada (deveria dar 401):', response.data)
    
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Erro 401 esperado - middleware de auth funcionando')
      console.log('📄 Resposta:', error.response?.data)
    } else {
      console.log('❌ Erro inesperado:')
      console.log(`Status: ${error.response?.status || 'N/A'}`)
      console.log(`Data:`, error.response?.data || error.message)
    }
  }
}

// Executa o teste
testVRChatRoute().catch(console.error)
