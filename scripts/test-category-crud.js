/**
 * Test Script - Category CRUD + Cache Invalidation
 * Simulates admin panel operations
 */

const AdvancedCacheService = require('../services/advancedCacheService');
const prisma = require('../config/prisma');

async function testCategoryCRUD() {
  console.log('🧪 TEST: Category CRUD + Cache Invalidation\n');

  let createdId = null;

  try {
    // 1. Initial state
    console.log('📊 Step 1: Get Initial Categories');
    const initial = await AdvancedCacheService.getCachedCategories();
    console.log(`✅ Initial: ${initial.length} categories`);
    console.log('Categories:', initial.map(c => `${c.name} (${c._count?.assets || 0} assets)`));
    console.log('\n');

    // 2. CREATE new category
    console.log('➕ Step 2: CREATE new category "test-debug"');
    const newCategory = await prisma.assetCategory.create({
      data: {
        name: 'test-debug',
        description: 'Test category for debugging',
        icon: 'cube',
        isActive: true
      }
    });
    console.log('✅ Created:', newCategory);
    createdId = newCategory.id;
    console.log('\n');

    // 3. Get categories WITHOUT cache invalidation (should still show old data)
    console.log('📂 Step 3: Get Categories WITHOUT Cache Invalidation');
    const beforeInvalidation = await AdvancedCacheService.getCachedCategories();
    console.log(`✅ Got ${beforeInvalidation.length} categories`);
    const hasNewCat1 = beforeInvalidation.some(c => c.name === 'test-debug');
    console.log(`❓ Has "test-debug"? ${hasNewCat1 ? '✅ YES (cache was auto-updated?)' : '❌ NO (still cached)'}`);
    console.log('\n');

    // 4. INVALIDATE cache
    console.log('🧹 Step 4: Invalidate Categories Cache');
    await AdvancedCacheService.invalidateCategoriesCache();
    console.log('✅ Cache invalidated');
    console.log('\n');

    // 5. Get categories AFTER invalidation (should show new data)
    console.log('📂 Step 5: Get Categories AFTER Cache Invalidation');
    const afterInvalidation = await AdvancedCacheService.getCachedCategories();
    console.log(`✅ Got ${afterInvalidation.length} categories`);
    const hasNewCat2 = afterInvalidation.some(c => c.name === 'test-debug');
    console.log(`❓ Has "test-debug"? ${hasNewCat2 ? '✅ YES' : '❌ NO'}`);
    console.log('\n');

    // 6. UPDATE category
    console.log('✏️ Step 6: UPDATE category');
    const updated = await prisma.assetCategory.update({
      where: { id: createdId },
      data: { description: 'Updated description' }
    });
    console.log('✅ Updated:', updated);
    console.log('\n');

    // 7. Invalidate again
    console.log('🧹 Step 7: Invalidate Cache After Update');
    await AdvancedCacheService.invalidateCategoriesCache();
    console.log('✅ Cache invalidated');
    console.log('\n');

    // 8. Verify update
    console.log('📂 Step 8: Verify Update');
    const afterUpdate = await AdvancedCacheService.getCachedCategories();
    const updatedCat = afterUpdate.find(c => c.name === 'test-debug');
    console.log('Updated category:', updatedCat);
    console.log('\n');

    // 9. DELETE category
    console.log('🗑️ Step 9: DELETE category');
    await prisma.assetCategory.delete({
      where: { id: createdId }
    });
    console.log('✅ Deleted');
    console.log('\n');

    // 10. Invalidate after delete
    console.log('🧹 Step 10: Invalidate Cache After Delete');
    await AdvancedCacheService.invalidateCategoriesCache();
    console.log('✅ Cache invalidated');
    console.log('\n');

    // 11. Verify deletion
    console.log('📂 Step 11: Verify Deletion');
    const afterDelete = await AdvancedCacheService.getCachedCategories();
    const stillHasCat = afterDelete.some(c => c.name === 'test-debug');
    console.log(`❓ Still has "test-debug"? ${stillHasCat ? '❌ YES (problem!)' : '✅ NO'}`);
    console.log(`Final count: ${afterDelete.length} categories`);
    console.log('\n');

    console.log('✅ TEST COMPLETED SUCCESSFULLY');

  } catch (error) {
    console.error('❌ Test error:', error);
    
    // Cleanup on error
    if (createdId) {
      try {
        await prisma.assetCategory.delete({ where: { id: createdId } });
        console.log('🧹 Cleanup: Deleted test category');
      } catch (e) {
        console.log('⚠️ Cleanup failed:', e.message);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

testCategoryCRUD();
