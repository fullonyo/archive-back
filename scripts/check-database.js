const { prisma } = require('../config/prisma');

async function checkDatabaseData() {
  try {
    console.log('🔍 Checking database data...');
    
    // Check users
    const userCount = await prisma.user.count();
    console.log(`\n👥 Users in database: ${userCount}`);
    
    if (userCount > 0) {
      const users = await prisma.user.findMany({
        select: { id: true, username: true, email: true },
        take: 5
      });
      console.log('First 5 users:', users);
    }
    
    // Check assets
    const assetCount = await prisma.asset.count();
    console.log(`\n📦 Assets in database: ${assetCount}`);
    
    if (assetCount > 0) {
      const assets = await prisma.asset.findMany({
        select: { id: true, title: true, userId: true, downloadCount: true },
        take: 5
      });
      console.log('First 5 assets:', assets);
    }
    
    // Check favorites
    const favoriteCount = await prisma.userFavorite.count();
    console.log(`\n❤️ Favorites in database: ${favoriteCount}`);
    
    // Check downloads
    const downloadCount = await prisma.assetDownload.count();
    console.log(`\n⬇️ Downloads in database: ${downloadCount}`);
    
    // Check reviews
    const reviewCount = await prisma.assetReview.count();
    console.log(`\n⭐ Reviews in database: ${reviewCount}`);
    
    console.log('\n✅ Database check completed!');
  } catch (error) {
    console.error('❌ Database check error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseData();