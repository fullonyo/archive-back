const { prisma } = require('../config/prisma');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // 1. Seed Asset Categories
    console.log('📂 Seeding asset categories...');
    
    const categories = await Promise.all([
      prisma.assetCategory.upsert({
        where: { name: 'avatar' },
        update: {},
        create: {
          name: 'avatar',
          description: 'Complete avatar packages and models',
          icon: 'user'
        }
      }),
      prisma.assetCategory.upsert({
        where: { name: 'clothing' },
        update: {},
        create: {
          name: 'clothing',
          description: 'Clothing and fashion accessories',
          icon: 'shirt'
        }
      }),
      prisma.assetCategory.upsert({
        where: { name: 'accessory' },
        update: {},
        create: {
          name: 'accessory',
          description: 'Hair, jewelry, and other accessories',
          icon: 'star'
        }
      }),
      prisma.assetCategory.upsert({
        where: { name: 'world' },
        update: {},
        create: {
          name: 'world',
          description: 'Virtual world environments and scenes',
          icon: 'globe'
        }
      }),
      prisma.assetCategory.upsert({
        where: { name: 'props' },
        update: {},
        create: {
          name: 'props',
          description: 'Props, furniture, and decorative objects',
          icon: 'cube'
        }
      }),
      prisma.assetCategory.upsert({
        where: { name: 'tools-systems' },
        update: {},
        create: {
          name: 'tools-systems',
          description: 'Tools and Systems for development and utilities',
          icon: 'wrench-screwdriver'
        }
      })
    ]);

    console.log(`✅ Created ${categories.length} categories`);

    // 2. Seed Users
    console.log('👥 Seeding users...');
    
    const adminPassword = await bcrypt.hash('admin123', 12);
    const testPassword = await bcrypt.hash('admin123', 12);

    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@vrchieve.com' },
      update: {},
      create: {
        username: 'admin',
        email: 'admin@vrchieve.com',
        passwordHash: adminPassword,
        accountType: 'ADMIN',
        isVerified: true,
        bio: 'System Administrator'
      }
    });

    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: testPassword,
        accountType: 'PREMIUM',
        isVerified: true,
        bio: 'Premium test user for development and testing'
      }
    });

    console.log('✅ Created admin and test users');

    // 3. Seed Sample Assets (opcional)
    console.log('📦 Seeding sample assets...');

    const avatarCategory = categories.find(cat => cat.name === 'avatar');
    const clothingCategory = categories.find(cat => cat.name === 'clothing');

    const sampleAssets = await Promise.all([
      prisma.asset.upsert({
        where: { 
          id: 1 // Assumindo que não existe
        },
        update: {},
        create: {
          title: 'Sample Anime Avatar',
          description: 'A cute anime-style avatar perfect for VRChat. Includes multiple outfits and expressions.',
          categoryId: avatarCategory.id,
          userId: testUser.id,
          fileName: 'sample_anime_avatar.unitypackage',
          fileSize: BigInt(25600000), // 25.6MB
          fileType: 'application/octet-stream',
          googleDriveId: 'sample_drive_id_1',
          googleDriveUrl: 'https://drive.google.com/sample/1',
          thumbnailUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop&crop=center&auto=format&q=60',
          downloadCount: 127,
          isApproved: true,
          tags: JSON.stringify(['anime', 'cute', 'female', 'vrchat-ready']),
          metadata: JSON.stringify({
            unity_version: '2022.3.6f1',
            sdk_version: '3.4.2',
            poly_count: 28540,
            texture_resolution: '2048x2048'
          })
        }
      }).catch(() => null), // Ignore se já existir
      
      prisma.asset.upsert({
        where: { 
          id: 2
        },
        update: {},
        create: {
          title: 'Casual Hoodie Set',
          description: 'Comfortable casual clothing set with hoodie, jeans and sneakers. Compatible with most avatars.',
          categoryId: clothingCategory.id,
          userId: testUser.id,
          fileName: 'casual_hoodie_set.unitypackage',
          fileSize: BigInt(15360000), // 15.36MB
          fileType: 'application/octet-stream',
          googleDriveId: 'sample_drive_id_2',
          googleDriveUrl: 'https://drive.google.com/sample/2',
          thumbnailUrl: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&h=400&fit=crop&crop=center&auto=format&q=60',
          downloadCount: 89,
          isApproved: true,
          tags: JSON.stringify(['casual', 'clothing', 'hoodie', 'modern']),
          metadata: JSON.stringify({
            unity_version: '2022.3.6f1',
            compatible_bodies: ['Generic', 'Rusk', 'Moe'],
            materials_count: 8
          })
        }
      }).catch(() => null)
    ]);

    const createdAssets = sampleAssets.filter(asset => asset !== null);
    console.log(`✅ Created ${createdAssets.length} sample assets`);

    // 4. Seed Sample Reviews
    if (createdAssets.length > 0) {
      console.log('⭐ Seeding sample reviews...');
      
      const reviews = await Promise.all([
        prisma.assetReview.upsert({
          where: {
            unique_user_asset_review: {
              userId: adminUser.id,
              assetId: createdAssets[0]?.id || 1
            }
          },
          update: {},
          create: {
            userId: adminUser.id,
            assetId: createdAssets[0]?.id || 1,
            rating: 5,
            comment: 'Excellent quality avatar! Very well optimized and looks amazing.'
          }
        }).catch(() => null)
      ]);

      console.log(`✅ Created ${reviews.filter(r => r !== null).length} sample reviews`);
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Test Credentials:');
    console.log('   Admin: admin@vrchieve.com / admin123');
    console.log('   User:  test@example.com / admin123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
