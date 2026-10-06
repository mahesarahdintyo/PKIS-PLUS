import { prisma } from '@/lib/prisma'
import { getCurrentUserProfile } from '@/lib/services/auth-server'
import { NextResponse } from 'next/server'

// GET - Fetch all folders for a specific parent (or root if parent_id is null)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const parentIdStr = searchParams.get('parentId')
    const reqLineId = searchParams.get('lineId')
    const includeAll = searchParams.get('includeAll') === 'true'
    const searchQuery = searchParams.get('search')?.trim()
    const showTrash = searchParams.get('trash') === 'true'
    const parentId = parentIdStr ? BigInt(parentIdStr) : null

    const userProfile = await getCurrentUserProfile()
    if (!userProfile.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const lineId =
      userProfile.role === 'operator' && userProfile.lineId
        ? userProfile.lineId
        : reqLineId

    const where: any = {}

    if (showTrash) {
      where.is_active = false
    } else {
      where.OR = [{ is_active: true }, { is_active: null }]
    }

    if (lineId) {
      where.line_id = lineId
    }

    if (searchQuery) {
      where.name = { contains: searchQuery, mode: 'insensitive' }
    }

    if (!includeAll && parentId === null) {
      where.parent_id = null
    } else if (!includeAll && parentIdStr) {
      where.parent_id = parentId
    }

    const folders = await prisma.folder.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    const folderIds = folders.map((f) => f.id)

    if (folderIds.length === 0) {
      return NextResponse.json(folders)
    }

    const childWhereCondition: any = {
      OR: [{ is_active: true }, { is_active: null }],
    }
    if (lineId) childWhereCondition.line_id = lineId

    const [childFolders, childDocuments] = await Promise.all([
      prisma.folder.findMany({
        where: {
          parent_id: { in: folderIds },
          ...childWhereCondition,
        },
        select: { parent_id: true },
      }),
      prisma.document.findMany({
        where: {
          folder_id: { in: folderIds },
          ...childWhereCondition,
        },
        select: { folder_id: true },
      }),
    ])

    const contentCountByFolderId = new Map<bigint, number>()

    for (const childFolder of childFolders) {
      if (childFolder.parent_id === null || childFolder.parent_id === undefined) continue
      contentCountByFolderId.set(
        childFolder.parent_id,
        (contentCountByFolderId.get(childFolder.parent_id) ?? 0) + 1
      )
    }

    for (const childDocument of childDocuments) {
      if (childDocument.folder_id === null || childDocument.folder_id === undefined) continue
      contentCountByFolderId.set(
        childDocument.folder_id,
        (contentCountByFolderId.get(childDocument.folder_id) ?? 0) + 1
      )
    }

    const foldersWithCounts = folders.map((folder) => ({
      ...folder,
      item_count: contentCountByFolderId.get(folder.id) ?? 0,
    }))

    return NextResponse.json(foldersWithCounts)
  } catch (error: any) {
    console.error('Folders GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new folder (auto-rename if name already exists)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, parentId, lineId: reqLineId } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Nama folder tidak boleh kosong' },
        { status: 400 }
      )
    }

    const userProfile = await getCurrentUserProfile()
    if (!userProfile.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const lineId =
      userProfile.role === 'operator' && userProfile.lineId
        ? userProfile.lineId
        : reqLineId

    const baseName = name.trim()
    const parsedParentId = parentId ? BigInt(parentId) : null

    const siblingWhere: any = {
      name: { startsWith: baseName, mode: 'insensitive' },
      OR: [{ is_active: true }, { is_active: null }],
    }
    if (lineId) siblingWhere.line_id = lineId
    if (parsedParentId !== null) {
      siblingWhere.parent_id = parsedParentId
    } else {
      siblingWhere.parent_id = null
    }

    const siblings = await prisma.folder.findMany({
      where: siblingWhere,
      select: { name: true },
    })

    const existingNames = new Set(
      siblings.map((f) => f.name.toLowerCase())
    )

    let finalName = baseName

    if (existingNames.has(baseName.toLowerCase())) {
      let counter = 1
      while (counter <= 99) {
        const candidate = `${baseName} (${String(counter).padStart(2, '0')})`
        if (!existingNames.has(candidate.toLowerCase())) {
          finalName = candidate
          break
        }
        counter++
      }
    }

    const newFolder = await prisma.folder.create({
      data: {
        name: finalName,
        parent_id: parsedParentId,
        line_id: lineId || null,
        is_active: true,
      },
    })

    return NextResponse.json(
      { ...newFolder, originalName: baseName, finalName },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Folders POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a folder beserta seluruh isinya secara rekursif (soft delete)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const idStr = searchParams.get('id')

    if (!idStr) {
      return NextResponse.json(
        { error: 'Folder ID is required' },
        { status: 400 }
      )
    }

    const rootId = BigInt(idStr)
    const userProfile = await getCurrentUserProfile()
    if (!userProfile.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Kumpulkan semua folder ID secara rekursif (BFS)
    const allFolderIds: bigint[] = [rootId]
    const queue: bigint[] = [rootId]

    while (queue.length > 0) {
      const currentIds = queue.splice(0, queue.length)
      const children = await prisma.folder.findMany({
        where: { parent_id: { in: currentIds } },
        select: { id: true },
      })

      if (children.length > 0) {
        const childIds = children.map((f) => f.id)
        allFolderIds.push(...childIds)
        queue.push(...childIds)
      }
    }

    // 1. Ambil ID dokumen di folder-folder ini untuk dihapus dari display_documents
    const docsToClear = await prisma.document.findMany({
      where: { folder_id: { in: allFolderIds } },
      select: { id: true },
    })

    if (docsToClear.length > 0) {
      const docIds = docsToClear.map((d) => d.id)
      await prisma.displayDocument.deleteMany({
        where: { document_id: { in: docIds } },
      })
    }

    // 2. Soft delete semua dokumen di dalam folder-folder tersebut
    await prisma.document.updateMany({
      where: { folder_id: { in: allFolderIds } },
      data: { is_active: false },
    })

    // 3. Soft delete semua folder (dari child ke root)
    await prisma.folder.updateMany({
      where: { id: { in: allFolderIds } },
      data: { is_active: false },
    })

    return NextResponse.json({
      success: true,
      message: 'Folder dan seluruh isinya berhasil di-soft delete',
      deletedFolderIds: allFolderIds,
    })
  } catch (error: any) {
    console.error('Folders DELETE error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
