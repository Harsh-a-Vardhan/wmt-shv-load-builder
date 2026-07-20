"use client";

import { useState } from "react";
import "./globals.css";
import { ACCOUNT_EMAIL } from "../lib/config";

const RAW_COLUMNS = [
  ["load_no", "Load #"],
  ["frt_ord_no", "Freight Order"],
  ["shipper_nm", "Shipper"],
  ["orig_city", "Orig City"],
  ["orig_st", "St"],
  ["dest_city", "Dest City"],
  ["dest_st", "St"],
  ["shp_dt", "Ship (MMDDYYYY)"],
  ["del_dt", "Deliver (MMDDYYYY)"],
  ["wgt", "Weight"],
  ["mode", "Mode"],
];

const CLEAN_COLUMNS = [
  ["load_number", "Load #"],
  ["bol_number", "BOL"],
  ["shipper_name", "Shipper"],
  ["origin_city", "Orig City"],
  ["origin_state", "St"],
  ["destination_city", "Dest City"],
  ["destination_state", "St"],
  ["ship_date", "Ship (DDMMYYYY)"],
  ["delivery_date", "Deliver (DDMMYYYY)"],
  ["weight", "Weight (lbs)"],
  ["equipment_type", "Equipment"],
];

export default function Home() {
  // The email is hardcoded as the default input value per the assignment.
  const [email, setEmail] = useState(ACCOUNT_EMAIL);
  const [rawLoads, setRawLoads] = useState(null);
  const [sanitized, setSanitized] = useState(null);
  const [result, setResult] = useState(null);
  const [banner, setBanner] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [pushing, setPushing] = useState(false);

  async function fetchLoads() {
    setFetching(true);
    setBanner(null);
    setSanitized(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/fetch-loads?email=${encodeURIComponent(email)}`
      );
      const data = await res.json();
      if (!data.ok) {
        setRawLoads(null);
        setBanner({
          kind: "err",
          text: `Fetch failed (${data.status || res.status}): ${
            data.error || "unknown error"
          }`,
        });
        return;
      }
      setRawLoads(data.loads);
      setBanner({
        kind: "info",
        text: `Fetched ${data.count} raw tender(s) from ${data.source}. Review them, then Sanitize & Push.`,
      });
    } catch (err) {
      setBanner({ kind: "err", text: `Fetch error: ${String(err)}` });
    } finally {
      setFetching(false);
    }
  }

  async function sanitizeAndPush() {
    if (!rawLoads || rawLoads.length === 0) return;
    setPushing(true);
    setBanner(null);
    try {
      const res = await fetch("/api/push-loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, loads: rawLoads }),
      });
      const data = await res.json();
      setSanitized(data.sanitized || null);
      setResult(data);

      if (!data.ok && data.error) {
        setBanner({ kind: "err", text: `Push failed: ${data.error}` });
      } else if (data.rejected && data.rejected.length > 0) {
        setBanner({
          kind: "err",
          text: `${data.accepted?.length || 0} accepted, ${
            data.rejected.length
          } rejected. See details below.`,
        });
      } else {
        setBanner({
          kind: "ok",
          text: `Success — ${
            data.accepted?.length || 0
          } load(s) pushed into the SHV TMS.`,
        });
      }
    } catch (err) {
      setBanner({ kind: "err", text: `Push error: ${String(err)}` });
    } finally {
      setPushing(false);
    }
  }

  return (
    <main className="wrap">
      <h1>Walmart → SHV Logistics Load Builder</h1>
      <p className="sub">
        Pull raw Walmart freight tenders, sanitize them per the SHV SOR rules
        (date reformatting, weight parsing, equipment mapping, whitespace
        cleanup), and push the built loads into the SHV Logistics TMS via API.
      </p>

      <div className="identity">
        <label htmlFor="email">Account email (bearer token):</label>
        <input
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className="buttons">
        <button
          className="btn-fetch"
          onClick={fetchLoads}
          disabled={fetching || pushing}
        >
          {fetching && <span className="spin" />}
          Fetch Loads
        </button>
        <button
          className="btn-push"
          onClick={sanitizeAndPush}
          disabled={pushing || fetching || !rawLoads || rawLoads.length === 0}
        >
          {pushing && <span className="spin" />}
          Sanitize &amp; Push
        </button>
      </div>
      <p className="hint">
        Step 1 — Fetch to see the raw tenders. Step 2 — Sanitize &amp; Push to
        transform and load them into the TMS.
      </p>

      {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}

      {rawLoads && (
        <section className="card">
          <h2>Raw Walmart tenders</h2>
          <p className="meta">
            {rawLoads.length} record(s) — exactly as returned by the Walmart
            Freight Tender API.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {RAW_COLUMNS.map(([k, label]) => (
                    <th key={k}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawLoads.map((r, i) => (
                  <tr key={i}>
                    {RAW_COLUMNS.map(([k]) => (
                      <td key={k} className="mono">
                        {r[k] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {sanitized && (
        <section className="card">
          <h2>Sanitized loads (SOR-ready)</h2>
          <p className="meta">
            Dates flipped to DDMMYYYY, weights parsed to whole-pound numbers,
            equipment mapped to the SOR's allowed values, strings trimmed.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {CLEAN_COLUMNS.map(([k, label]) => (
                    <th key={k}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sanitized.map((r, i) => {
                  const accepted = result?.accepted?.includes(r.load_number);
                  return (
                    <tr key={i}>
                      {CLEAN_COLUMNS.map(([k]) => (
                        <td key={k} className="mono">
                          {k === "equipment_type" ? (
                            <span
                              className={`pill ${
                                r[k].includes("Reefer") ? "reefer" : "dry"
                              }`}
                            >
                              {r[k]}
                            </span>
                          ) : (
                            String(r[k])
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {result?.rejected?.length > 0 && (
            <ul className="rejected-list">
              {result.rejected.map((rj, i) => (
                <li key={i}>
                  <strong>{rj.load_number}</strong>:{" "}
                  {(rj.errors || []).join("; ")}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
