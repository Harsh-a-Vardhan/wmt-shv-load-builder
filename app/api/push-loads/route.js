import { NextResponse } from "next/server";
import {
  ACCOUNT_EMAIL,
  SHV_LOADS_URL,
  SHV_MAX_BATCH,
} from "../../../lib/config";
import { sanitizeAll } from "../../../lib/sanitize";

// POST /api/push-loads
// Body: { email?: string, loads: RawWalmartTender[] }
//
// Sanitizes the raw Walmart tenders into SOR-ready loads and pushes them to the
// SHV SOR Integration API in batches of up to 50. Returns both the sanitized
// payload (so the UI can show what was transformed) and the merged SOR result.
export const dynamic = "force-dynamic";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Malformed JSON body" },
      { status: 400 }
    );
  }

  const email = (payload.email || "").trim() || ACCOUNT_EMAIL;
  const rawLoads = Array.isArray(payload.loads) ? payload.loads : [];

  if (rawLoads.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No loads to push. Fetch loads first." },
      { status: 400 }
    );
  }

  // 1) Sanitize every raw tender into an SOR-ready load.
  const sanitized = sanitizeAll(rawLoads);

  // 2) Push in batches of <= 50 (the SOR's per-request cap).
  const batches = chunk(sanitized, SHV_MAX_BATCH);
  const accepted = [];
  const rejected = [];
  const messages = [];

  try {
    for (const batch of batches) {
      const res = await fetch(SHV_LOADS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${email}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ loads: batch }),
        cache: "no-store",
      });

      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }

      if (Array.isArray(body.accepted)) accepted.push(...body.accepted);
      if (Array.isArray(body.rejected)) rejected.push(...body.rejected);
      if (body.message) messages.push(body.message);

      // Surface hard failures (401 / 400 / 429) that aren't per-load 422s.
      if (!res.ok && res.status !== 422) {
        return NextResponse.json(
          {
            ok: false,
            status: res.status,
            error: `SHV SOR API returned ${res.status}`,
            detail: body,
            sanitized,
          },
          { status: res.status }
        );
      }
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to reach SHV SOR API",
        detail: String(err),
        sanitized,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: rejected.length === 0,
    sanitized,
    accepted,
    rejected,
    message: messages.join(" "),
  });
}
