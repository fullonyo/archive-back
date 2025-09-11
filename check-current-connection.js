const { PrismaClient } = require('@prisma/client');

async function checkConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Verificando dados da conexão VRChat...\n');
    
    const connection = await prisma.vRChatConnection.findFirst({
      where: { isActive: true }
    });
    
    if (connection) {
      console.log('✅ Conexão encontrada:');
      console.log('👤 Usuário:', connection.vrchatDisplayName);
      console.log('🆔 VRChat ID:', connection.vrchatUserId);
      console.log('🔗 Conectado em:', connection.createdAt);
      console.log('🔄 Última sincronização:', connection.lastSyncAt);
      console.log('🍪 Campo auth_cookie existe:', 'authCookie' in connection ? 'SIM' : 'NÃO');
      console.log('🍪 Valor auth_cookie:', connection.authCookie || 'NULL (vazio)');
      console.log('\n📝 Dados completos da conexão:');
      console.log(JSON.stringify(connection, null, 2));
    } else {
      console.log('❌ Nenhuma conexão VRChat encontrada');
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkConnection();
