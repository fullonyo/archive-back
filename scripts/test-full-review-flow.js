const AssetService = require('../services/assetService');

async function testFullReviewFlow() {
  try {
    console.log('🧪 Testing Full Review Flow...');
    
    // Get initial asset state
    console.log('\n📦 Initial asset state:');
    let asset = await AssetService.findAssetById(25);
    console.log('- Title:', asset?.title);
    console.log('- Average Rating:', asset?.averageRating);
    console.log('- Review Count:', asset?._count?.reviews);
    
    // Add a new review with different rating
    console.log('\n⭐ Adding new review with rating 3...');
    const newReview = await AssetService.createOrUpdateReview({
      userId: 4, // teste_usuario
      assetId: 25,
      rating: 3,
      comment: 'Good asset, but could be better.'
    });
    console.log('- Review added:', newReview.isUpdate ? 'Updated existing' : 'Created new');
    
    // Get updated asset state
    console.log('\n📦 Updated asset state:');
    asset = await AssetService.findAssetById(25);
    console.log('- Title:', asset?.title);
    console.log('- Average Rating:', asset?.averageRating);
    console.log('- Review Count:', asset?._count?.reviews);
    console.log('- Reviews:');
    asset?.reviews?.forEach((review, index) => {
      console.log(`  ${index + 1}. ${review.rating} stars by ${review.user.username}: "${review.comment}"`);
    });
    
    console.log('\n✅ Full review flow test completed!');
    
  } catch (error) {
    console.error('❌ Full review flow test error:', error);
  }
}

testFullReviewFlow();