import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { NextResponse } from "next/server";

// GET - Fetch documents
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const folderIdStr = searchParams.get("folderId");
    const folderId = folderIdStr ? parseInt(folderIdStr) : null;

    const reqLineId = searchParams.get("lineId");
    const searchQuery = searchParams.get("search")?.trim();
    const includeHidden = searchParams.get("includeHidden") === "true";
    const showTrash = searchParams.get("trash") === "true";

    const userProfile = await getCurrentUserProfile();
    const lineId = userProfile.role === "operator" && userProfile.lineId ? userProfile.lineId : reqLineId;

    const supabase = await createClient();

    let query = supabase
      .from("documents")
      .select(`
        id,
        title,
        description,
        file_name,
        file_path,
        file_type,
        file_size,
        target_time,
        hidden_from_operator,
        created_at,
        folder_id,
        line_id,
        folders (
          id,
          name,
          line_id
        )
      `);

    if (showTrash) {
      query = query.eq("is_active", false);
    } else {
      query = query.or("is_active.eq.true,is_active.is.null");
    }

    // Filter berdasarkan folder
    if (searchQuery) {
      // Saat search, jangan filter folder
    } else if (folderIdStr) {
      query = query.eq("folder_id", folderId);
    } else {
      query = query.is("folder_id", null);
    }

    // Filter search
    if (searchQuery) {
      const escapedSearch = searchQuery.replace(/[%_]/g, "\\$&");

      query = query.or(
        `title.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%,file_name.ilike.%${escapedSearch}%`
      );
    }

    if (!includeHidden) {
      query = query.eq("hidden_from_operator", false);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Filter line di sisi server
    const documents = lineId
      ? data.filter((doc: any) => {
        // Kalau dokumen ada di dalam folder
        if (doc.folder_id) {
          return doc.folders?.line_id === lineId
        }

        // Kalau dokumen berada di root Line
        return doc.line_id === lineId
      })
      : data

    const transformedDocuments = documents.map((doc: any) => ({
      id: doc.id,
      lineId: doc.line_id ?? doc.folders?.line_id ?? undefined,
      title: doc.title,
      description: doc.description,
      category: "Lainnya",
      type: doc.file_type,
      file: {
        name: doc.file_name,
        path: doc.file_path,
        size: doc.file_size,
      },
      targetTime: doc.target_time,
      hiddenFromOperator: doc.hidden_from_operator,
    }));

    return NextResponse.json(transformedDocuments);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create document
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      title,
      description,
      category_id,
      file_name,
      file_path,
      file_size,
      file_type,
      target_time
    } = body;

    if (!title || !file_name || !file_path) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("documents")
      .insert({
        title,
        description,
        category_id: category_id || null,
        file_name,
        file_path,
        file_size,
        file_type,
        target_time: target_time || null,
      })
      .select();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data[0], { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
