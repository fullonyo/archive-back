/**
 * Debug Script - Cache System
 * Tests cache invalidation and category retrieval
 */

const AdvancedCacheService = require('../services/advancedCacheService');
const CategoryService = require('../services/categoryService');
const prisma = require('../config/prisma');

async function debugCache() {
  console.log('🔍 DEBUG: Cache System\n');

  try {
    // 1. Check cache stats BEFORE
    console.log('📊 Step 1: Cache Stats BEFORE');
    const statsBefore = await AdvancedCacheService.getCacheStats();
    console.log(JSON.stringify(statsBefore, null, 2));
    console.log('\n');

    // 2. Get categories (should be cached)
    console.log('📂 Step 2: Get Categories (First Call - Will Cache)');
    const cats1 = await AdvancedCacheService.getCachedCategories();
    console.log(`✅ Got ${cats1.length} categories:`, cats1.map(c => c.name));
    console.log('\n');

    // 3. Check cache stats AFTER first call
    console.log('📊 Step 3: Cache Stats AFTER First Call');
    const statsAfter1 = await AdvancedCacheService.getCacheStats();
    console.log(JSON.stringify(statsAfter1, null, 2));
    console.log('\n');

    // 4. Get categories again (should come from cache)
    console.log('📂 Step 4: Get Categories (Second Call - Should Hit Cache)');
    const cats2 = await AdvancedCacheService.getCachedCategories();
    console.log(`✅ Got ${cats2.length} categories:`, cats2.map(c => c.name));
    console.log('\n');

    // 5. Invalidate cache
    console.log('🧹 Step 5: Invalidate Categories Cache');
    await AdvancedCacheService.invalidateCategoriesCache();
    console.log('✅ Cache invalidated');
    console.log('\n');

    // 6. Check cache stats AFTER invalidation
    console.log('📊 Step 6: Cache Stats AFTER Invalidation');
    const statsAfter2 = await AdvancedCacheService.getCacheStats();
    console.log(JSON.stringify(statsAfter2, null, 2));
    console.log('\n');

    // 7. Get categories after invalidation (should query DB)
    console.log('📂 Step 7: Get Categories (After Invalidation - Should Query DB)');
    const cats3 = await AdvancedCacheService.getCachedCategories();
    console.log(`✅ Got ${cats3.length} categories:`, cats3.map(c => c.name));
    console.log('\n');

    // 8. Direct DB query (for comparison)
    console.log('💾 Step 8: Direct DB Query (For Comparison)');
    const dbCats = await prisma.assetCategory.findMany({
      where: { isActive: true },
      include: { _count: { select: { assets: true } } },
      orderBy: { name: 'asc' }
    });
    console.log(`✅ DB has ${dbCats.length} active categories:`, dbCats.map(c => c.name));
    console.log('\n');

    // 9. Compare cache vs DB
    console.log('🔍 Step 9: Compare Cache vs DB');
    const cacheNames = cats3.map(c => c.name).sort();
    const dbNames = dbCats.map(c => c.name).sort();
    
    console.log('Cache categories:', cacheNames);
    console.log('DB categories:', dbNames);
    
    if (JSON.stringify(cacheNames) === JSON.stringify(dbNames)) {
      console.log('✅ Cache and DB are IN SYNC');
    } else {
      console.log('❌ Cache and DB are OUT OF SYNC');
      const onlyInCache = cacheNames.filter(n => !dbNames.includes(n));
      const onlyInDB = dbNames.filter(n => !cacheNames.includes(n));
      if (onlyInCache.length) console.log('Only in cache:', onlyInCache);
      if (onlyInDB.length) console.log('Only in DB:', onlyInDB);
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugCache();
