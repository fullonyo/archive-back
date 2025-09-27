const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function updateOtherCategory() {
  try {
    console.log('🔍 Verificando categoria "Other"...')
    
    // Verificar se existe categoria com name "other"
    const otherCategory = await prisma.assetCategory.findFirst({
      where: {
        OR: [
          { name: 'other' },
          { name: 'Others' },
          { description: { contains: 'Other' } }
        ]
      }
    })

    // Verificar se já existe tools-systems
    const toolsSystemsCategory = await prisma.assetCategory.findUnique({
      where: { name: 'tools-systems' }
    })

    if (otherCategory) {
      console.log(`📝 Encontrada categoria "Other" (ID: ${otherCategory.id}): ${otherCategory.name}`)
      
      if (toolsSystemsCategory) {
        console.log(`⚠️ Categoria "tools-systems" já existe (ID: ${toolsSystemsCategory.id})`)
        console.log('🔄 Migrando assets da categoria "Other" para "tools-systems"...')
        
        // Migrar assets da categoria "Other" para "tools-systems"
        const assetsUpdated = await prisma.asset.updateMany({
          where: { categoryId: otherCategory.id },
          data: { categoryId: toolsSystemsCategory.id }
        })
        
        console.log(`✅ ${assetsUpdated.count} assets migrados`)
        
        // Deletar categoria "Other"
        await prisma.assetCategory.delete({
          where: { id: otherCategory.id }
        })
        
        console.log('✅ Categoria "Other" removida com sucesso!')
      } else {
        console.log('🔄 Atualizando categoria "Other" para "tools-systems"...')
        
        // Atualizar para tools-systems
        await prisma.assetCategory.update({
          where: { id: otherCategory.id },
          data: {
            name: 'tools-systems',
            description: 'Tools and Systems for development and utilities',
            icon: 'wrench-screwdriver'
          }
        })
        
        console.log('✅ Categoria atualizada com sucesso!')
      }
    } else {
      console.log('ℹ️ Nenhuma categoria "Other" encontrada')
      
      if (!toolsSystemsCategory) {
        console.log('📝 Criando categoria "Tools and Systems"...')
        await prisma.assetCategory.create({
          data: {
            name: 'tools-systems',
            description: 'Tools and Systems for development and utilities',
            icon: 'wrench-screwdriver'
          }
        })
        console.log('✅ Categoria "Tools and Systems" criada!')
      }
    }

    // Listar todas as categorias para verificar
    const allCategories = await prisma.assetCategory.findMany({
      select: {
        id: true,
        name: true,
        description: true
      },
      orderBy: { name: 'asc' }
    })

    console.log('\n📋 Categorias atuais:')
    allCategories.forEach(cat => {
      console.log(`  - ${cat.name} | ${cat.description}`)
    })

  } catch (error) {
    console.error('❌ Erro ao atualizar categoria:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateOtherCategory()