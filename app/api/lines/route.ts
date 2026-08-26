import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeHidden = searchParams.get("includeHidden") === "true";
    const showTrash = searchParams.get("trash") === "true";
    const userProfile = await getCurrentUserProfile();
    const supabase = await createClient();

    let query = supabase.from("lines").select("*");

    if (userProfile.role === "operator" && userProfile.lineId) {
      query = query.eq("id", userProfile.lineId);
    } else if (!includeHidden) {
      query = query.eq("hidden_from_operator", false);
    }

    if (showTrash) {
      query = query.eq("is_active", false);
    } else {
      query = query.or("is_active.eq.true,is_active.is.null");
    }

    const [{ data: lines, error }, { data: documents, error: documentsError }] = await Promise.all([
      query.order("name", { ascending: true }),
      supabase
        .from("documents")
        .select("line_id, folders ( line_id )")
        .or("is_active.eq.true,is_active.is.null"),
    ]);

    if (error || documentsError) {
      return NextResponse.json({ error: error?.message ?? documentsError?.message }, { status: 500 });
    }

    const documentCountByLineId = new Map<string, number>();
    for (const document of documents ?? []) {
      const folder = Array.isArray(document.folders) ? document.folders[0] : document.folders;
      const lineId = document.line_id ?? folder?.line_id;
      if (lineId) {
        documentCountByLineId.set(lineId, (documentCountByLineId.get(lineId) ?? 0) + 1);
      }
    }

    return NextResponse.json(
      (lines ?? []).map((line) => ({
        ...line,
        document_count: documentCountByLineId.get(line.id) ?? 0,
      }))
    );
  } catch (error) {
    console.error("Lines GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
    // machine_type: string (slug) atau null untuk line non-produksi
    const machine_type =
      typeof body.machine_type === "string" && body.machine_type.trim()
        ? body.machine_type.trim()
        : null;

    if (!name) {
      return NextResponse.json(
        { error: "Nama line produksi tidak boleh kosong" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Cek duplikat nama (case-insensitive)
    const { data: existing } = await supabase
      .from("lines")
      .select("id")
      .ilike("name", name)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Line produksi dengan nama "${name}" sudah ada. Gunakan nama yang berbeda.` },
        { status: 409 }
      );
    }

    const { data: newLine, error } = await supabase
      .from("lines")
      .insert({
        name,
        description,
        machine_type,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(newLine, { status: 201 });
  } catch (error) {
    console.error("Lines POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
    // machine_type: string (slug) atau null untuk line non-produksi
    // Kirim undefined berarti tidak diubah, kirim null berarti dihapus
    const hasMachineType = "machine_type" in body;
    const machine_type = hasMachineType
      ? (typeof body.machine_type === "string" && body.machine_type.trim()
          ? body.machine_type.trim()
          : null)
      : undefined;

    if (!id) {
      return NextResponse.json(
        { error: "Line ID tidak valid" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Nama line produksi tidak boleh kosong" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Cek duplikat nama (case-insensitive), kecuali line yang sedang diedit
    const { data: existing } = await supabase
      .from("lines")
      .select("id")
      .ilike("name", name)
      .eq("is_active", true)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Line produksi dengan nama "${name}" sudah ada. Gunakan nama yang berbeda.` },
        { status: 409 }
      );
    }

    const updatePayload: Record<string, unknown> = { name, description };
    if (hasMachineType) updatePayload.machine_type = machine_type;

    const { data: updatedLine, error } = await supabase
      .from("lines")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updatedLine);
  } catch (error) {
    console.error("Lines PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const hiddenFromOperator = body.hidden_from_operator;

    if (!id) {
      return NextResponse.json(
        { error: "Line ID is required" },
        { status: 400 }
      );
    }

    if (typeof hiddenFromOperator !== "boolean") {
      return NextResponse.json(
        { error: "Hidden from operator must be a boolean" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: updatedLine, error } = await supabase
      .from("lines")
      .update({
        hidden_from_operator: hiddenFromOperator,
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Lines PATCH supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Jika tidak ada baris yang ter-update, kemungkinan diblokir oleh RLS
    if (!updatedLine) {
      return NextResponse.json(
        { error: "Data tidak ditemukan atau Anda tidak memiliki izin untuk mengubah visibilitas line produksi ini." },
        { status: 403 }
      );
    }

    return NextResponse.json(updatedLine);
  } catch (error) {
    console.error("Lines PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Line ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Get all folders of this line
    const { data: folders } = await supabase
      .from("folders")
      .select("id")
      .eq("line_id", id);

    const folderIds = (folders ?? []).map((f) => f.id);

    // 2. Find documents directly in the line or in its folders to clear display_documents
    const queryBuilder = supabase
      .from("documents")
      .select("id");

    let docQuery = queryBuilder;
    if (folderIds.length > 0) {
      docQuery = docQuery.or(`line_id.eq.${id},folder_id.in.(${folderIds.join(",")})`);
    } else {
      docQuery = docQuery.eq("line_id", id);
    }

    const { data: documents } = await docQuery;

    if (documents && documents.length > 0) {
      const docIds = documents.map((doc) => doc.id);
      
      // Clean display_documents references
      await supabase.from("display_documents").delete().in("document_id", docIds);
      for (const docId of docIds) {
        await supabase.from("display_documents").delete().eq("document->>id", docId);
      }

      // Soft delete documents
      await supabase
        .from("documents")
        .update({ is_active: false })
        .in("id", docIds);
    }

    // 3. Soft delete folders
    if (folderIds.length > 0) {
      await supabase
        .from("folders")
        .update({ is_active: false })
        .in("id", folderIds);
    }

    // 4. Delete display heartbeats (if any)
    await supabase.from("display_heartbeats").delete().eq("line_id", id);

    // 5. Soft delete the line from database
    const { error } = await supabase
      .from("lines")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Line soft deleted successfully",
    });
  } catch (error) {
    console.error("Lines DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
