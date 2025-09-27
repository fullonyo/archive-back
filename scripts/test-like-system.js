const AssetService = require('../services/assetService');

async function testLikeSystem() {
  try {
    console.log('=== Teste do Sistema de Curtidas ===');
    
    // Buscar asset sem usuário logado
    console.log('\n1. Buscando asset SEM usuário logado:');
    const assetWithoutUser = await AssetService.findAssetById(25);
    console.log(`Asset ${assetWithoutUser.id} - isLiked: ${assetWithoutUser.isLiked}`);
    
    // Buscar asset COM usuário logado (usuário 11 - testuser)
    console.log('\n2. Buscando asset COM usuário logado (ID: 11):');
    const assetWithUser = await AssetService.findAssetById(25, 11);
    console.log(`Asset ${assetWithUser.id} - isLiked: ${assetWithUser.isLiked}`);
    
    // Testar toggle de favorito
    console.log('\n3. Alternando favorito para usuário 11 no asset 25:');
    const toggleResult = await AssetService.toggleFavorite(11, 25);
    console.log('Resultado do toggle:', toggleResult);
    
    // Buscar novamente para verificar mudança
    console.log('\n4. Verificando estado após toggle:');
    const assetAfterToggle = await AssetService.findAssetById(25, 11);
    console.log(`Asset ${assetAfterToggle.id} - isLiked: ${assetAfterToggle.isLiked}`);
    console.log(`Total de favoritos: ${assetAfterToggle._count.favorites}`);
    
  } catch (error) {
    console.error('Erro no teste:', error);
  } finally {
    process.exit(0);
  }
}

testLikeSystem();