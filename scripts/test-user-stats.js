const UserService = require('../services/userService');

async function testUserStats() {
  try {
    console.log('=== Teste das Estatísticas do Usuário ===');
    
    // Testar estatísticas do usuário 11 (testuser)
    console.log('\n1. Estatísticas do usuário 11 (testuser):');
    const stats = await UserService.getUserStats(11);
    console.log('Estatísticas:', JSON.stringify(stats, null, 2));
    
    // Verificar detalhes das estatísticas
    console.log('\n2. Detalhamento das estatísticas:');
    console.log(`- Uploads: ${stats.uploadsCount} assets`);
    console.log(`- Downloads: ${stats.totalDownloads} downloads`);
    console.log(`- Favoritos recebidos: ${stats.favoritesReceived} curtidas nos seus assets`);
    console.log(`- Avaliação média: ${stats.averageRating} estrelas`);
    console.log(`- Total de reviews: ${stats.totalReviews} avaliações`);
    
    // Testar estatísticas do usuário 1 (admin/sistema)
    console.log('\n3. Estatísticas do usuário 1 (admin):');
    const adminStats = await UserService.getUserStats(1);
    console.log('Estatísticas Admin:', JSON.stringify(adminStats, null, 2));
    
  } catch (error) {
    console.error('Erro no teste:', error);
  } finally {
    process.exit(0);
  }
}

testUserStats();