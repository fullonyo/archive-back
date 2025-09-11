const { PrismaClient } = require('@prisma/client');
const vrchatService = require('./services/vrchatService');

async function testVRChatAPI() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testando API real do VRChat...\n');
    
    // Busca conexão do usuário sistema
    const connection = await prisma.vRChatConnection.findFirst({
      where: { isActive: true }
    });
    
    if (!connection) {
      console.log('❌ Nenhuma conexão VRChat ativa encontrada');
      return;
    }
    
    console.log('✅ Conexão encontrada:', connection.vrchatDisplayName);
    console.log('🍪 Auth Cookie:', connection.authCookie ? 'PRESENTE' : 'AUSENTE');
    
    if (!connection.authCookie) {
      console.log('❌ Cookie de autenticação não encontrado. É necessário reconectar a conta VRChat.');
      return;
    }
    
    console.log('\n👥 Testando busca de amigos...');
    const friendsResult = await vrchatService.getFriends(connection.authCookie);
    console.log('Resultado amigos:', friendsResult);
    
    console.log('\n🌍 Testando busca de mundos recentes...');
    const worldsResult = await vrchatService.getRecentWorlds(connection.authCookie);
    console.log('Resultado mundos:', worldsResult);
    
    console.log('\n👤 Testando busca de usuário atual...');
    const userResult = await vrchatService.getCurrentUser(connection.authCookie);
    console.log('Resultado usuário:', userResult);
    
  } catch (error) {
    console.error('❌ Erro ao testar API:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testVRChatAPI();
