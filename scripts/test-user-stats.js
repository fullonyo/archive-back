const UserService = require('../services/userService');

async function testUserStats() {
  try {
    console.log('🧪 Testing User Stats...');
    
    // Test getting stats for user ID 1
    const userId = 1;
    console.log(`\n📊 Getting stats for user ${userId}...`);
    
    const stats = await UserService.getUserStats(userId);
    console.log('Stats result:', stats);
    
    // Test getting user by ID with stats
    console.log(`\n👤 Getting user ${userId} with stats...`);
    const user = await UserService.findUserById(userId);
    console.log('User result:', user);
    
    console.log('\n✅ Test completed!');
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testUserStats();