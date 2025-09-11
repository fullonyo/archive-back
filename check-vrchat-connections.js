// Teste para verificar se há conexão VRChat salva no banco
const { PrismaClient } = require('@prisma/client')

async function checkVRChatConnections() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔍 Verificando conexões VRChat no banco...')
    
    // Lista todas as conexões VRChat
    const connections = await prisma.vRChatConnection.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    })
    
    console.log('📊 Total de conexões encontradas:', connections.length)
    
    if (connections.length === 0) {
      console.log('❌ Nenhuma conexão VRChat encontrada!')
      console.log('💡 Você precisa conectar sua conta VRChat primeiro.')
    } else {
      console.log('✅ Conexões encontradas:')
      connections.forEach((conn, index) => {
        console.log(`\n${index + 1}. Usuário: ${conn.user.username} (ID: ${conn.user.id})`)
        console.log(`   VRChat User: ${conn.vrchatUsername}`)
        console.log(`   Display Name: ${conn.vrchatDisplayName}`)
        console.log(`   Conectado em: ${conn.createdAt}`)
        console.log(`   Última sincronização: ${conn.lastSyncAt}`)
        console.log(`   Ativo: ${conn.isActive}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar conexões:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkVRChatConnections()
