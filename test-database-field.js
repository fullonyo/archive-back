const { PrismaClient } = require('@prisma/client');

async function testDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testando nova estrutura da tabela...');
    
    const connection = await prisma.vRChatConnection.findFirst({
      where: { isActive: true }
    });
    
    if (connection) {
      console.log('✅ Conexão encontrada:', connection.vrchatDisplayName);
      console.log('🍪 Campo auth_cookie presente:', connection.authCookie !== undefined ? 'SIM' : 'NÃO');
      console.log('🍪 Valor auth_cookie:', connection.authCookie ? 'PRESENTE' : 'NULL');
    } else {
      console.log('❌ Nenhuma conexão encontrada');
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
