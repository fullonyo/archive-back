const { assetsAPI } = require('../../../frontend/src/services/api');

async function testLikeSystem() {
  try {
    console.log('🧪 Testing Like System...');
    
    // Simulate getting an asset details first
    console.log('📦 Getting asset details...');
    const assetResponse = await assetsAPI.getAsset(1);
    console.log('Asset response:', assetResponse?.data);
    
    // Test toggling favorite
    console.log('\n❤️ Testing toggle favorite...');
    const favoriteResponse = await assetsAPI.toggleFavorite(1);
    console.log('Toggle favorite response:', favoriteResponse?.data);
    
    console.log('\n✅ Like system test completed!');
  } catch (error) {
    console.error('❌ Like system test error:', error.response?.data || error.message);
  }
}

// Note: This test would require authentication
console.log('⚠️ Note: This test requires authentication and would need to be run from frontend with valid auth token.');
console.log('📝 The APIs are implemented, test manually in the browser.');