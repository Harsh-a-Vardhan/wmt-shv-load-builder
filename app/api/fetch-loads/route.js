import { NextResponse } from "next/server";
import { ACCOUNT_EMAIL, WMT_LOADS_URL } from "../../../lib/config";

// GET /api/fetch-loads
// Server-side proxy to the Walmart Freight Tender API. Runs on the server so
// the browser never makes a cross-origin call (no CORS headaches) and so the
// bearer token is attached consistently.
export const dynamic = "force-dynamic";

export async function GET(request) {
  const email =
    request.nextUrl.searchParams.get("email")?.trim() || ACCOUNT_EMAIL;

  try {
    const res = await fetch(WMT_LOADS_URL, {
      headers: { Authorization: `Bearer ${email}` },
      cache: "no-store",
    });

    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: res.status,
          error: `Walmart API returned ${res.status}`,
          detail: body,
        },
        { status: res.status }
      );
    }

    return NextResponse.json({
      ok: true,
      source: body.source ?? "WMT Freight Tender Portal",
      count: body.count ?? (body.loads ? body.loads.length : 0),
      loads: body.loads ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Failed to reach Walmart API", detail: String(err) },
      { status: 502 }
    );
  }
}
