const AssetService = require('../services/assetService');

async function testAssetWithRating() {
  try {
    console.log('🧪 Testing Asset Details with Rating...');
    
    // Test getting asset 25 with its rating
    console.log('\n📦 Getting asset 25 details...');
    const asset = await AssetService.findAssetById(25);
    console.log('Asset result:');
    console.log('- Title:', asset?.title);
    console.log('- ID:', asset?.id);
    console.log('- Average Rating:', asset?.averageRating);
    console.log('- Review Count:', asset?._count?.reviews);
    console.log('- Reviews:', asset?.reviews?.length, 'reviews found');
    
    if (asset?.reviews) {
      asset.reviews.forEach((review, index) => {
        console.log(`  Review ${index + 1}: ${review.rating} stars - "${review.comment}" by ${review.user.username}`);
      });
    }
    
    console.log('\n✅ Asset details test completed!');
    
  } catch (error) {
    console.error('❌ Asset details test error:', error);
  }
}

testAssetWithRating();