import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET - Fetch all part numbers
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: partNumbers, error } = await supabase
      .from("part_numbers")
      .select("*")
      .order("code", { ascending: true });

    if (error) {
      console.error("Error fetching part numbers:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(partNumbers ?? []);
  } catch (error) {
    console.error("Part numbers GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new part number
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, description } = body;

    if (!code || !code.trim()) {
      return NextResponse.json(
        { error: "Kode part number wajib diisi" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check user auth and role to verify they are admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin role required" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("part_numbers")
      .insert({
        code: code.trim(),
        description: description ? description.trim() : null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating part number:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Part numbers POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a part number by ID
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID part number wajib disertakan" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check user auth and role to verify they are admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin role required" }, { status: 403 });
    }

    const { error } = await supabase
      .from("part_numbers")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting part number:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Part numbers DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
