"use client";

import { useCallback, useEffect, useState } from "react";
import type { SpaReportDefinition } from "@/lib/spa-modules";

type Column = { key: string; label: string; format?: "number" | "currency" | "minutes" };
type ReportValue = string | number | null;
type ReportResponse = {
  summary: { label: string; value: ReportValue; format?: "number" | "currency" | "minutes" }[];
  columns: Column[];
  rows: Record<string, ReportValue>[];
  range: { from: string; to: string };
  error?: string;
};

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function format(value: ReportValue, kind?: Column["format"]): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (kind === "currency") {
    return new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(number || 0);
  }
  if (kind === "minutes") return `${Math.round(number || 0).toLocaleString()} min`;
  if (kind === "number") return (number || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value).replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export default function SpaReportWorkspace({ definition }: { definition: SpaReportDefinition }) {
  const initialRange = defaultRange();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [appliedRange, setAppliedRange] = useState(initialRange);
  const [report, setReport] = useState<ReportResponse>({ summary: [], columns: [], rows: [], range: initialRange });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const search = new URLSearchParams(appliedRange);
      const response = await fetch(`/api/spa/reports/${definition.slug}?${search}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const data = await response.json() as ReportResponse;
      if (!response.ok) throw new Error(data.error || "Unable to generate report");
      setReport(data);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to generate report");
      setReport((current) => ({ ...current, summary: [], rows: [] }));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [appliedRange, definition.slug]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    if (from > to) {
      setError("The start date must be before the end date.");
      return;
    }
    setAppliedRange({ from, to });
  };

  const exportCsv = () => {
    const rows = report.rows.map((row) => report.columns.map((column) => row[column.key]));
    const csv = [report.columns.map((column) => column.label), ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${definition.slug}-report-${appliedRange.from}-${appliedRange.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="spa-workspace-page">
      <header className="spa-workspace-header">
        <div className="spa-workspace-heading">
          <span className="spa-workspace-icon"><i className={`bi bi-${definition.icon}`} /></span>
          <div>
            <p>Reports &amp; Analytics</p>
            <h1>{definition.title}</h1>
            <span>{definition.description}</span>
          </div>
        </div>
        <div className="spa-workspace-actions">
          <button type="button" className="spa-secondary-button" onClick={() => window.print()}><i className="bi bi-printer" /> Print</button>
          <button type="button" className="spa-primary-button" onClick={exportCsv} disabled={report.rows.length === 0}><i className="bi bi-download" /> Export CSV</button>
        </div>
      </header>

      {error && <div className="spa-workspace-alert danger" role="alert"><i className="bi bi-exclamation-circle" />{error}</div>}

      <form className="spa-report-filters" onSubmit={applyFilters}>
        <label><span>From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label><span>To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button type="submit" className="spa-primary-button" disabled={loading}><i className="bi bi-funnel" /> Apply</button>
        <span>{appliedRange.from} → {appliedRange.to}</span>
      </form>

      <section className="spa-workspace-summary spa-report-summary" aria-label={`${definition.title} summary`}>
        {(loading && report.summary.length === 0 ? Array.from({ length: 4 }, (_, index) => ({ label: `Loading ${index + 1}`, value: "…", format: undefined })) : report.summary).map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{format(item.value, item.format)}</strong>
            <i className={`bi bi-${definition.icon}`} />
          </article>
        ))}
      </section>

      <section className="spa-workspace-card">
        <div className="spa-report-table-heading">
          <div><h2>Report detail</h2><p>{report.rows.length.toLocaleString()} row{report.rows.length === 1 ? "" : "s"} for the selected period</p></div>
          <button type="button" className="spa-secondary-button" onClick={() => void load()} disabled={loading}><i className={`bi bi-arrow-clockwise ${loading ? "spin" : ""}`} /> Refresh</button>
        </div>
        <div className="spa-workspace-table-wrap">
          {loading ? (
            <div className="spa-workspace-state"><span className="spinner-border spinner-border-sm" /><p>Generating {definition.title.toLowerCase()}…</p></div>
          ) : report.rows.length === 0 ? (
            <div className="spa-workspace-state empty"><i className="bi bi-bar-chart" /><h2>No report data</h2><p>No activity was found for the selected period.</p></div>
          ) : (
            <table className="spa-workspace-table">
              <thead><tr>{report.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
              <tbody>{report.rows.map((row, rowIndex) => <tr key={rowIndex}>{report.columns.map((column) => <td key={column.key}>{format(row[column.key], column.format)}</td>)}</tr>)}</tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
