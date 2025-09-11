// Script para reinicializar o VRChat Service com Prisma corrigido
const VRChatService = require('./services/vrchatService')

console.log('🔄 Reinicializando VRChat Service...')

// Reset do singleton
VRChatService.reset()

console.log('✅ VRChat Service reinicializado com sucesso!')

// Teste básico
async function testService() {
  try {
    console.log('🧪 Testando getVRChatConnection...')
    const connection = await VRChatService.getVRChatConnection(3) // Usuario sistema
    console.log('✅ Teste concluído:', connection ? 'Conexão encontrada' : 'Nenhuma conexão')
  } catch (error) {
    console.error('❌ Erro no teste:', error.message)
  }
}

testService()
