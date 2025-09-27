const { prisma } = require('../config/prisma');

async function createTestData() {
  try {
    console.log('🧪 Creating test data for statistics...');
    
    // Create a category first
    let category = await prisma.assetCategory.findFirst({
      where: { name: 'Avatars' }
    });
    
    if (!category) {
      category = await prisma.assetCategory.create({
        data: {
          name: 'Avatars',
          description: 'VRChat Avatar assets',
          icon: 'user-circle'
        }
      });
      console.log('✅ Created category:', category.name);
    }
    
    // Get admin user
    const adminUser = await prisma.user.findFirst({
      where: { username: 'admin' }
    });
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }
    
    console.log(`👤 Using user: ${adminUser.username} (ID: ${adminUser.id})`);
    
    // Create test assets
    const assets = [];
    for (let i = 1; i <= 3; i++) {
      const asset = await prisma.asset.create({
        data: {
          title: `Test Avatar ${i}`,
          description: `Test description for avatar ${i}`,
          categoryId: category.id,
          userId: adminUser.id,
          fileName: `avatar_${i}.vrca`,
          fileSize: BigInt(1024 * 1024 * 5), // 5MB
          fileType: 'application/x-vrca',
          googleDriveId: `test_drive_id_${i}`,
          googleDriveUrl: `https://drive.google.com/file/d/test_drive_id_${i}/view`,
          thumbnailUrl: `https://drive.google.com/uc?id=test_thumb_${i}`,
          downloadCount: Math.floor(Math.random() * 100) + 10,
          isApproved: true,
          isActive: true,
          tags: JSON.stringify(['avatar', 'test', 'example'])
        }
      });
      assets.push(asset);
      console.log(`✅ Created asset: ${asset.title} (Downloads: ${asset.downloadCount})`);
    }
    
    // Create test user to make favorites and reviews
    let testUser = await prisma.user.findFirst({
      where: { username: 'developer' }
    });
    
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          username: 'developer',
          email: 'dev@test.com',
          passwordHash: 'test',
          accountType: 'FREE'
        }
      });
    }
    
    // Create favorites for each asset
    for (const asset of assets) {
      await prisma.userFavorite.create({
        data: {
          userId: testUser.id,
          assetId: asset.id
        }
      });
      console.log(`❤️ Created favorite for: ${asset.title}`);
    }
    
    // Create reviews for assets
    const ratings = [5, 4, 5]; // Good ratings
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      await prisma.assetReview.create({
        data: {
          userId: testUser.id,
          assetId: asset.id,
          rating: ratings[i],
          comment: `Great avatar! Rating: ${ratings[i]} stars`,
          isApproved: true
        }
      });
      console.log(`⭐ Created review for: ${asset.title} (Rating: ${ratings[i]})`);
    }
    
    // Create some downloads
    for (const asset of assets) {
      for (let j = 0; j < 3; j++) {
        await prisma.assetDownload.create({
          data: {
            assetId: asset.id,
            userId: testUser.id,
            ipAddress: `192.168.1.${j + 1}`,
            userAgent: 'Test Browser'
          }
        });
      }
      console.log(`⬇️ Created downloads for: ${asset.title}`);
    }
    
    console.log('\n🎉 Test data created successfully!');
    
    // Test the stats now
    const UserService = require('../services/userService');
    const stats = await UserService.getUserStats(adminUser.id);
    console.log('\n📊 Updated stats for admin user:', stats);
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();