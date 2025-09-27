const AssetService = require('../services/assetService');

async function testReviewSystem() {
  try {
    console.log('🧪 Testing Review System...');
    
    // Test getting reviews for asset 25
    console.log('\n📝 Getting reviews for asset 25...');
    const reviews = await AssetService.getAssetReviews(25, { page: 1, limit: 10 });
    console.log('Reviews result:', reviews);
    
    // Test creating a review
    console.log('\n⭐ Creating review for asset 25...');
    const reviewData = {
      userId: 2, // developer user
      assetId: 25,
      rating: 5,
      comment: 'Excellent asset! Very well made.'
    };
    
    const createResult = await AssetService.createOrUpdateReview(reviewData);
    console.log('Create review result:', createResult);
    
    // Test getting reviews again
    console.log('\n📝 Getting reviews again...');
    const updatedReviews = await AssetService.getAssetReviews(25, { page: 1, limit: 10 });
    console.log('Updated reviews result:', updatedReviews);
    
    console.log('\n✅ Review system test completed!');
    
  } catch (error) {
    console.error('❌ Review system test error:', error);
  }
}

testReviewSystem();