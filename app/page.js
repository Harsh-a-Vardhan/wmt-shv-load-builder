"use client";

import { useState } from "react";
import "./globals.css";
import { ACCOUNT_EMAIL } from "../lib/config";

const RAW_COLUMNS = [
  ["load_no", "load_no"],
  ["frt_ord_no", "frt_ord_no"],
  ["shipper_nm", "shipper_nm"],
  ["orig_city", "orig_city"],
  ["orig_st", "orig_st"],
  ["dest_city", "dest_city"],
  ["dest_st", "dest_st"],
  ["shp_dt", "shp_dt"],
  ["del_dt", "del_dt"],
  ["wgt", "wgt"],
  ["mode", "mode"],
];

export default function Home() {
  // The email is hardcoded (per the assignment) and used as the bearer token
  // input for every API call; it is displayed read-only in the header.
  const email = ACCOUNT_EMAIL;
  const [rawLoads, setRawLoads] = useState(null);
  const [source, setSource] = useState("");
  const [result, setResult] = useState(null);
  const [banner, setBanner] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [pushing, setPushing] = useState(false);

  async function fetchLoads() {
    setFetching(true);
    setBanner(null);
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
      setSource(data.source);
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
      setResult(data);
      if (!data.ok && data.error) {
        setBanner({ kind: "err", text: `Push failed: ${data.error}` });
      }
    } catch (err) {
      setBanner({ kind: "err", text: `Push error: ${String(err)}` });
    } finally {
      setPushing(false);
    }
  }

  // Build a load_number -> sanitized payload lookup for the push results.
  const sanitizedByNo = {};
  if (result?.sanitized) {
    for (const s of result.sanitized) sanitizedByNo[s.load_number] = s;
  }
  const acceptedSet = new Set(result?.accepted || []);
  const rejectedByNo = {};
  for (const rj of result?.rejected || []) rejectedByNo[rj.load_number] = rj;

  return (
    <main className="wrap">
      <h1>Walmart → SHV Logistics Load Builder</h1>
      <p className="sub">
        Fetch raw Walmart freight tenders, sanitize them per the SHV rules, and
        push them into the TMS. Auth token / identity:{" "}
        <span className="mono ident">{email}</span>
      </p>

      <div className="buttons">
        <button
          className="btn-fetch"
          onClick={fetchLoads}
          disabled={fetching || pushing}
        >
          {fetching && <span className="spin" />}1 · Fetch loads
        </button>
        <button
          className="btn-push"
          onClick={sanitizeAndPush}
          disabled={pushing || fetching || !rawLoads || rawLoads.length === 0}
        >
          {pushing && <span className="spin" />}2 · Sanitize &amp; push
        </button>
      </div>
      <p className="hint">
        Fetch first to see the raw tenders, then sanitize &amp; push them to the
        TMS.
      </p>

      {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}

      {rawLoads && (
        <section className="card">
          <h2>Raw tenders from Walmart portal ({rawLoads.length})</h2>
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

      {result && (result.sanitized || result.error) && (
        <section className="card">
          <h2>
            Push results{" "}
            {result.sanitized && (
              <span className="count">
                ({acceptedSet.size}/{result.sanitized.length} accepted)
              </span>
            )}
          </h2>

          {result.sanitized?.map((s) => {
            const accepted = acceptedSet.has(s.load_number);
            const rej = rejectedByNo[s.load_number];
            return (
              <div className="load-card" key={s.load_number}>
                <div className="load-head">
                  <span className={`status ${accepted ? "ok" : "bad"}`}>
                    {accepted ? "pushed" : "rejected"}
                  </span>
                  <span className="mono load-no">{s.load_number}</span>
                </div>
                <div className="sent-label">Sent to TMS:</div>
                <pre className="json">{JSON.stringify(s, null, 2)}</pre>
                {rej && (
                  <ul className="rejected-list">
                    {(rej.errors || []).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
