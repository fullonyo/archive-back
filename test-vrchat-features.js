const axios = require('axios')

// Teste das novas funcionalidades VRChat
async function testVRChatFeatures() {
  console.log('🧪 TESTE - Novas Funcionalidades VRChat')
  console.log('═══════════════════════════════════════════')
  
  const baseURL = 'http://localhost:5000/api'
  
  // Token de autenticação (substitua pelo token válido)
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MywidXNlcm5hbWUiOiJzaXN0ZW1hIiwiZW1haWwiOiJzaXN0ZW1hQHZyY2hpZXZlLmNvbSIsInJvbGUiOiJTSVNURU1BIiwiaWF0IjoxNzM2NDY3NTgzLCJleHAiOjE3MzY0NzExODN9.YQ1JlLj4gNEb2IXhsxZX_VdmBjN8aeIBKt8hPqvCG2Y'
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  try {
    console.log('📊 1. Testando endpoint de estatísticas...')
    const statsResponse = await axios.get(`${baseURL}/vrchat/stats`, { headers })
    console.log('✅ Stats:', JSON.stringify(statsResponse.data, null, 2))
    
    console.log('\n👥 2. Testando endpoint de amigos...')
    const friendsResponse = await axios.get(`${baseURL}/vrchat/friends`, { headers })
    console.log('✅ Friends:', JSON.stringify(friendsResponse.data, null, 2))
    
    console.log('\n🌍 3. Testando endpoint de mundos recentes...')
    const worldsResponse = await axios.get(`${baseURL}/vrchat/recent-worlds`, { headers })
    console.log('✅ Recent Worlds:', JSON.stringify(worldsResponse.data, null, 2))
    
    console.log('\n🎮 4. Testando endpoint de instâncias...')
    const instancesResponse = await axios.get(`${baseURL}/vrchat/instances`, { headers })
    console.log('✅ Instances:', JSON.stringify(instancesResponse.data, null, 2))
    
    console.log('\n🎉 TODOS OS ENDPOINTS FUNCIONANDO!')
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.status, error.response?.data?.message || error.message)
    
    if (error.response?.status === 404) {
      console.log('💡 Dica: Conecte sua conta VRChat primeiro para acessar os dados')
    }
  }
}

// Executa o teste
testVRChatFeatures().catch(console.error)
