import { createClient } from "@supabase/supabase-js";
import { validateWorkspace } from "../../../lib/validation";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
async function authorized(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const token = request.headers.get("authorization");
  if (!token?.startsWith("Bearer ")) return null;
  const client = createClient(url, key, {
    global: { headers: { Authorization: token } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token.slice(7));
  return error || !data.user ? null : client;
}
export async function GET(request: Request) {
  const client = await authorized(request);
  if (!client)
    return Response.json(
      { error: "Authentication required" },
      { status: 401, headers },
    );
  const { data, error } = await client.rpc("read_workspace");
  if (error)
    return Response.json(
      { error: "Cloud workspace unavailable. Check the database migration." },
      { status: 503, headers },
    );
  return Response.json(data, { headers });
}
export async function PUT(request: Request) {
  const client = await authorized(request);
  if (!client)
    return Response.json(
      { error: "Authentication required" },
      { status: 401, headers },
    );
  try {
    const raw = await request.text();
    if (raw.length > 8_000_000)
      return Response.json(
        { error: "Workspace exceeds the upload limit" },
        { status: 413, headers },
      );
    const body = JSON.parse(raw);
    if (
      !Number.isSafeInteger(body.version) ||
      body.version < 0 ||
      typeof body.mutationId !== "string" ||
      !/^[\da-f-]{36}$/i.test(body.mutationId)
    )
      throw Error("Invalid sync metadata");
    const workspace = validateWorkspace(body.data);
    const { data, error } = await client.rpc("save_workspace", {
      payload: workspace,
      expected_version: body.version,
      mutation_id: body.mutationId,
    });
    if (error) {
      if (error.message.includes("VERSION_CONFLICT"))
        return Response.json(
          {
            error:
              "Cloud data changed on another device. Download or review the cloud copy before retrying.",
          },
          { status: 409, headers },
        );
      return Response.json(
        {
          error:
            "Could not save the cloud workspace. No partial changes were applied.",
        },
        { status: 422, headers },
      );
    }
    return Response.json(data, { headers });
  } catch {
    return Response.json(
      {
        error:
          "Workspace validation failed. Check amounts, dates and account references.",
      },
      { status: 400, headers },
    );
  }
}
