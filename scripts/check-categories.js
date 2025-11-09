const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCategories() {
  try {
    console.log('🔍 Checking categories in database...\n');
    
    const categories = await prisma.assetCategory.findMany({
      include: {
        _count: {
          select: { assets: true }
        }
      }
    });

    console.log(`📊 Found ${categories.length} categories:\n`);
    
    categories.forEach(cat => {
      console.log(`  - ${cat.name} (ID: ${cat.id})`);
      console.log(`    Active: ${cat.isActive}`);
      console.log(`    Assets: ${cat._count.assets}`);
      console.log(`    Icon: ${cat.icon || 'none'}`);
      console.log(`    Description: ${cat.description || 'none'}\n`);
    });

    if (categories.length === 0) {
      console.log('⚠️  No categories found! Creating default categories...\n');
      
      const defaultCategories = [
        { name: 'Avatars', description: 'Complete avatar models and packages', icon: 'Shirt', isActive: true },
        { name: 'Worlds', description: 'Virtual worlds and environments', icon: 'Globe', isActive: true },
        { name: 'Shaders', description: 'Visual effects and shaders', icon: 'Sparkles', isActive: true },
        { name: 'Effects', description: 'Particle effects and VFX', icon: 'Wand2', isActive: true },
        { name: 'Accessories', description: 'Avatar accessories and props', icon: 'Star', isActive: true },
        { name: 'Tools', description: 'Unity scripts and tools', icon: 'Box', isActive: true },
        { name: 'Animations', description: 'Animation packs and poses', icon: 'Package', isActive: true },
        { name: 'Textures', description: 'Texture packs and materials', icon: 'Grid3x3', isActive: true },
      ];

      for (const cat of defaultCategories) {
        const created = await prisma.assetCategory.create({
          data: cat
        });
        console.log(`✅ Created: ${created.name}`);
      }

      console.log('\n✨ Default categories created successfully!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCategories();
