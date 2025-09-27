const { prisma } = require('../config/prisma');

async function checkUserAssets() {
  try {
    console.log('=== Verificando Assets dos Usuários ===');
    
    // Verificar usuário 11
    console.log('\n1. Usuário 11 (testuser):');
    const user11 = await prisma.user.findUnique({
      where: { id: 11 },
      include: {
        assets: {
          select: {
            id: true,
            title: true,
            isActive: true,
            isApproved: true
          }
        }
      }
    });
    
    if (user11) {
      console.log(`Username: ${user11.username}`);
      console.log(`Total de assets: ${user11.assets.length}`);
      console.log('Assets:', user11.assets);
    } else {
      console.log('Usuário 11 não encontrado');
    }
    
    // Verificar usuário 1 (admin)
    console.log('\n2. Usuário 1 (admin):');
    const user1 = await prisma.user.findUnique({
      where: { id: 1 },
      include: {
        assets: {
          select: {
            id: true,
            title: true,
            isActive: true,
            isApproved: true
          }
        }
      }
    });
    
    if (user1) {
      console.log(`Username: ${user1.username}`);
      console.log(`Total de assets: ${user1.assets.length}`);
      console.log('Assets:', user1.assets);
    }
    
    // Verificar favoritos do usuário 11
    console.log('\n3. Favoritos do usuário 11:');
    const favorites = await prisma.userFavorite.findMany({
      where: { userId: 11 },
      include: {
        asset: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });
    console.log(`Total de favoritos: ${favorites.length}`);
    console.log('Favoritos:', favorites);
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    process.exit(0);
  }
}

checkUserAssets();