import { createClient } from '@/lib/supabase/server'
import { getCurrentUserProfile } from '@/lib/services/auth-server'
import { NextResponse } from 'next/server'

// GET - Fetch all folders for a specific parent (or root if parent_id is null)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const parentIdStr = searchParams.get('parentId')
    const reqLandId = searchParams.get('landId')
    const includeAll = searchParams.get('includeAll') === 'true'
    const searchQuery = searchParams.get('search')?.trim()
    const showTrash = searchParams.get('trash') === 'true'
    const parentId = parentIdStr ? parseInt(parentIdStr) : null

    const userProfile = await getCurrentUserProfile()
    const landId = userProfile.role === 'operator' && userProfile.landId ? userProfile.landId : reqLandId

    const supabase = await createClient()

    let query = supabase.from('folders').select('*')

    if (showTrash) {
      query = query.eq('is_active', false)
    } else {
      query = query.or('is_active.eq.true,is_active.is.null')
    }

    if (landId) {
      query = query.eq('land_id', landId)
    }

    if (searchQuery) {
      const escapedSearch = searchQuery.replace(/[%_]/g, '\\$&')
      query = query.ilike('name', `%${escapedSearch}%`)
    }

    if (!includeAll && parentId === null) {
      query = query.is('parent_id', null)
    } else if (!includeAll && parentIdStr) {
      query = query.eq('parent_id', parentId)
    }

    const { data: folders, error } = await query.order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const folderIds = (folders ?? []).map((folder) => folder.id)

    if (folderIds.length === 0) {
      return NextResponse.json(folders ?? [])
    }

    let childFolderQuery = supabase
      .from('folders')
      .select('parent_id')
      .in('parent_id', folderIds)
      .or('is_active.eq.true,is_active.is.null')

    let childDocumentQuery = supabase
      .from('documents')
      .select('folder_id')
      .in('folder_id', folderIds)
      .or('is_active.eq.true,is_active.is.null')

    if (landId) {
      childFolderQuery = childFolderQuery.eq('land_id', landId)
      childDocumentQuery = childDocumentQuery.eq('land_id', landId)
    }

    const [
      { data: childFolders, error: childFoldersError },
      { data: childDocuments, error: childDocumentsError },
    ] = await Promise.all([childFolderQuery, childDocumentQuery])

    if (childFoldersError || childDocumentsError) {
      return NextResponse.json(
        { error: childFoldersError?.message ?? childDocumentsError?.message },
        { status: 500 }
      )
    }

    const contentCountByFolderId = new Map<number, number>()

    for (const childFolder of childFolders ?? []) {
      if (typeof childFolder.parent_id !== 'number') continue
      contentCountByFolderId.set(
        childFolder.parent_id,
        (contentCountByFolderId.get(childFolder.parent_id) ?? 0) + 1
      )
    }

    for (const childDocument of childDocuments ?? []) {
      if (typeof childDocument.folder_id !== 'number') continue
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
  } catch (error) {
    console.error('Folders GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new folder (auto-rename if name already exists)
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { name, parentId, landId: reqLandId } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Nama folder tidak boleh kosong' },
        { status: 400 }
      )
    }

    const userProfile = await getCurrentUserProfile()
    const landId = userProfile.role === 'operator' && userProfile.landId ? userProfile.landId : reqLandId

    const baseName = name.trim()
    const supabase = await createClient()
    const parsedParentId = parentId ? parseInt(parentId) : null

    // Ambil semua folder dalam scope yang sama (parent + land)
    let siblingQuery = supabase
      .from('folders')
      .select('name')
      .ilike('name', `${baseName}%`)
      .or('is_active.eq.true,is_active.is.null')

    if (landId) {
      siblingQuery = siblingQuery.eq('land_id', landId)
    }

    if (parsedParentId !== null) {
      siblingQuery = siblingQuery.eq('parent_id', parsedParentId)
    } else {
      siblingQuery = siblingQuery.is('parent_id', null)
    }

    const { data: siblings } = await siblingQuery

    // Cari nama yang tersedia dengan pola: "Nama", "Nama (01)", "Nama (02)", dst.
    const existingNames = new Set(
      (siblings ?? []).map((f) => f.name.toLowerCase())
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

    const { data: newFolder, error } = await supabase
      .from('folders')
      .insert({
        name: finalName,
        parent_id: parsedParentId,
        land_id: landId,
      })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { ...newFolder[0], originalName: baseName, finalName },
      { status: 201 }
    )
  } catch (error) {
    console.error('Folders POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


// DELETE - Delete a folder beserta seluruh isinya (dokumen & sub-folder) secara rekursif
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

    const rootId = parseInt(idStr)
    const supabase = await createClient()

    // Kumpulkan semua folder ID secara rekursif (BFS)
    const allFolderIds: number[] = [rootId]
    const queue: number[] = [rootId]

    while (queue.length > 0) {
      const currentIds = queue.splice(0, queue.length)

      const { data: children, error: childErr } = await supabase
        .from('folders')
        .select('id')
        .in('parent_id', currentIds)

      if (childErr) {
        return NextResponse.json({ error: childErr.message }, { status: 500 })
      }

      if (children && children.length > 0) {
        const childIds = children.map((f) => f.id as number)
        allFolderIds.push(...childIds)
        queue.push(...childIds)
      }
    }

    // 1. Ambil ID dokumen yang berada di dalam folder-folder ini untuk dihapus dari layar display
    const { data: docsToClear, error: docsFetchError } = await supabase
      .from('documents')
      .select('id')
      .in('folder_id', allFolderIds)

    if (!docsFetchError && docsToClear && docsToClear.length > 0) {
      const docIds = docsToClear.map((d) => d.id)
      await supabase.from('display_documents').delete().in('document_id', docIds)
      for (const docId of docIds) {
        await supabase.from('display_documents').delete().eq('document->>id', docId)
      }
    }

    // 2. Soft delete semua dokumen yang berada di dalam folder-folder tersebut
    const { error: docDeleteError } = await supabase
      .from('documents')
      .update({ is_active: false })
      .in('folder_id', allFolderIds)

    if (docDeleteError) {
      return NextResponse.json({ error: docDeleteError.message }, { status: 500 })
    }

    // 3. Soft delete semua folder (dari child ke root)
    const { error: folderDeleteError } = await supabase
      .from('folders')
      .update({ is_active: false })
      .in('id', allFolderIds)

    if (folderDeleteError) {
      return NextResponse.json({ error: folderDeleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Folder dan seluruh isinya berhasil di-soft delete',
      deletedFolderIds: allFolderIds,
    })
  } catch (error) {
    console.error('Folders DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
