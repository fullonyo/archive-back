const { prisma } = require('../config/prisma');

async function checkAssetUrls() {
  try {
    const assets = await prisma.asset.findMany({
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        imageUrls: true,
        googleDriveUrl: true,
        googleDriveId: true
      },
      take: 3
    });

    console.log('=== Asset URL Check ===\n');
    
    assets.forEach((asset, index) => {
      console.log(`Asset ${index + 1}: ${asset.title}`);
      console.log(`  ID: ${asset.id}`);
      console.log(`  thumbnailUrl: ${asset.thumbnailUrl}`);
      console.log(`  imageUrls: ${asset.imageUrls}`);
      console.log(`  googleDriveUrl: ${asset.googleDriveUrl}`);
      console.log(`  googleDriveId: ${asset.googleDriveId}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAssetUrls();
