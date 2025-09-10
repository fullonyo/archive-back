const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

async function fixSystemUserImages() {
  try {
    console.log('🔧 Atualizando usuário sistema para remover URLs inválidas...');
    
    const updatedUser = await prisma.user.update({
      where: { username: 'sistema' },
      data: {
        avatarUrl: null,
        bannerUrl: null
      }
    });
    
    console.log('✅ Usuário sistema atualizado:');
    console.log('ID:', updatedUser.id);
    console.log('Username:', updatedUser.username);
    console.log('AvatarUrl:', updatedUser.avatarUrl);
    console.log('BannerUrl:', updatedUser.bannerUrl);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSystemUserImages();
