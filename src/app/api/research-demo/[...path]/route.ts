import { NextRequest, NextResponse } from "next/server";

type Context = { params: { path: string[] } };

function allowed(path: string[]) {
  if (path.length === 1 && ["metadata", "users", "models", "evaluation", "alerts", "predict", "assistant"].includes(path[0] || "")) return true;
  const profileId = path[1] || "";
  const resource = path[2] || "";
  return path.length === 3 && path[0] === "users" && /^demo-[a-z0-9-]{1,40}$/.test(profileId) && ["observations", "baseline", "analysis"].includes(resource);
}

async function proxy(request: NextRequest, { params }: Context) {
  const path = params.path;
  if (!allowed(path)) return NextResponse.json({ detail: "Research demo endpoint not found." }, { status: 404 });
  const base = (process.env.ML_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const url = base + "/api/research-demo/" + path.map(encodeURIComponent).join("/") + "?" + request.nextUrl.searchParams.toString();
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: request.method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ detail: "Research demo service is unavailable. Start FastAPI on port 8000 and try again." }, { status: 503 });
  }
}

export function GET(request: NextRequest, context: Context) { return proxy(request, context); }
export function POST(request: NextRequest, context: Context) {
  if (!["predict", "assistant"].includes(context.params.path.join("/"))) return NextResponse.json({ detail: "Research demo endpoint not found." }, { status: 404 });
  return proxy(request, context);
}
