"use client";

import { useMemo, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { SPA_MODULE_MAP, type SpaFieldDefinition } from "@/lib/spa-modules";
import { GUIDE_COMPONENTS, USER_GUIDE_SECTIONS, type GuidePage } from "@/lib/user-guide";

function fieldLabel(field: SpaFieldDefinition): string {
  const required = field.required ? " *" : "";
  const options = field.options?.length ? ` (${field.options.join(" / ")})` : "";
  return `${field.label}${required}${options}`;
}

function pageFields(page: GuidePage): string[] {
  if (page.fields) return page.fields;
  if (!page.moduleKey) return [];
  const definition = SPA_MODULE_MAP.get(page.moduleKey);
  return definition?.fields.map(fieldLabel) || [];
}

function pageActions(page: GuidePage): string[] {
  if (page.actions) return page.actions;
  if (!page.moduleKey) return [];
  return ["Add", "View details", "Edit", "Delete", "Search", "Filter status", "Export CSV"];
}

function searchableText(page: GuidePage): string {
  return [
    page.title,
    page.route,
    page.permission,
    page.audience,
    page.summary,
    page.note,
    ...pageFields(page),
    ...pageActions(page),
  ].filter(Boolean).join(" ").toLowerCase();
}

export default function UserGuide() {
  const [query, setQuery] = useState("");
  const [copiedRoute, setCopiedRoute] = useState("");
  const allSectionIds = useMemo(() => new Set(USER_GUIDE_SECTIONS.map((section) => section.id)), []);
  const [openSections, setOpenSections] = useState<Set<string>>(allSectionIds);

  const filteredSections = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return USER_GUIDE_SECTIONS;
    return USER_GUIDE_SECTIONS
      .map((section) => ({
        ...section,
        pages: section.pages.filter((page) => searchableText(page).includes(term)),
      }))
      .filter((section) => section.title.toLowerCase().includes(term) || section.pages.length > 0);
  }, [query]);

  const pageCount = USER_GUIDE_SECTIONS.reduce((total, section) => total + section.pages.length, 0);
  const routeCount = USER_GUIDE_SECTIONS.flatMap((section) => section.pages).filter((page) => page.route).length;
  const resourceCount = new Set(
    USER_GUIDE_SECTIONS.flatMap((section) => section.pages)
      .map((page) => page.permission)
      .filter((permission) => permission !== "Public" && permission !== "Component reference")
  ).size;
  const visiblePageCount = filteredSections.reduce((total, section) => total + section.pages.length, 0);

  const toggleSection = (id: string, open: boolean) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const setAllSections = (open: boolean) => {
    setOpenSections(open ? new Set(USER_GUIDE_SECTIONS.map((section) => section.id)) : new Set());
  };

  const copyRoute = async (route: string) => {
    try {
      await navigator.clipboard.writeText(route);
      setCopiedRoute(route);
      window.setTimeout(() => setCopiedRoute(""), 1800);
    } catch {
      setCopiedRoute("");
    }
  };

  const printGuide = () => {
    setAllSections(true);
    document.body.classList.add("printing-user-guide");
    const cleanup = () => document.body.classList.remove("printing-user-guide");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(() => window.print(), 80);
  };

  return (
    <div className="user-guide-page" id="user-guide-top">
      <header className="guide-hero">
        <div className="guide-hero-copy">
          <div className="guide-eyebrow"><i className="bi bi-compass" /> Page / UI Guide · August 2026</div>
          <h1>Dagi Spa<br /><em>Management System</em></h1>
          <p>A screen-by-screen guide to routes, access permissions, actions, widgets and operational fields.</p>
          <div className="guide-hero-actions">
            <a href="#guide-contents" className="guide-primary-action"><i className="bi bi-list-ul" /> Browse contents</a>
            <button type="button" onClick={printGuide}><i className="bi bi-printer" /> Print guide</button>
          </div>
        </div>
        <div className="guide-hero-stats" aria-label="Guide summary">
          <article><strong>{pageCount}</strong><span>screen definitions</span></article>
          <article><strong>{routeCount}</strong><span>documented routes</span></article>
          <article><strong>{resourceCount}</strong><span>permission resources</span></article>
          <article><strong>EN / አማ</strong><span>interface languages</span></article>
        </div>
      </header>

      <section className="guide-boundary" aria-label="Sales and POS architecture boundary">
        <span><i className="bi bi-shield-check" /></span>
        <div>
          <p>Architecture boundary</p>
          <h2>Spa operations and Sales/POS stay separate</h2>
          <p>The Spa system records visits, treatments, service quantities, towels and inventory usage. It prints a price-free <strong>Service Order Draft</strong>. Pricing, discounts, tax, payment and the official receipt are completed only in the separate Sales/POS application.</p>
        </div>
        <div className="guide-boundary-list"><span>No POS database connection</span><span>No invoices or receipts</span><span>No payment collection</span></div>
      </section>

      <div className="guide-layout" id="guide-contents">
        <aside className="guide-toc" aria-label="Guide table of contents">
          <div className="guide-toc-heading"><span>Contents</span><small>{USER_GUIDE_SECTIONS.length} sections</small></div>
          <nav>
            {USER_GUIDE_SECTIONS.map((section) => (
              <a key={section.id} href={`#${section.id}`} className={filteredSections.some((item) => item.id === section.id) ? "" : "muted"}>
                <b>{String(section.number).padStart(2, "0")}</b>
                <i className={`bi bi-${section.icon}`} />
                <span>{section.title}</span>
              </a>
            ))}
          </nav>
          <div className="guide-toc-help">
            <i className="bi bi-info-circle" />
            <p>An asterisk marks a required field. Permission codes match the Roles &amp; Permissions matrix.</p>
          </div>
        </aside>

        <main className="guide-main">
          <div className="guide-toolbar">
            <label className="guide-search">
              <i className="bi bi-search" />
              <span className="visually-hidden">Search the user guide</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages, routes, permissions or fields…" />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><i className="bi bi-x-lg" /></button>}
            </label>
            <span className="guide-search-count">{query ? `${visiblePageCount} matches` : `${pageCount} pages`}</span>
            <div className="guide-expand-actions">
              <button type="button" onClick={() => setAllSections(true)}>Expand all</button>
              <button type="button" onClick={() => setAllSections(false)}>Collapse all</button>
            </div>
          </div>

          {filteredSections.length === 0 ? (
            <div className="guide-no-results"><i className="bi bi-search" /><h2>No guide pages found</h2><p>Try a route, page title, permission code or field name.</p><button type="button" onClick={() => setQuery("")}>Clear search</button></div>
          ) : filteredSections.map((section) => (
            <details
              key={section.id}
              id={section.id}
              className="guide-section"
              open={query ? true : openSections.has(section.id)}
              onToggle={(event) => { if (!query) toggleSection(section.id, event.currentTarget.open); }}
            >
              <summary>
                <span className="guide-section-number">{String(section.number).padStart(2, "0")}</span>
                <span className="guide-section-icon"><i className={`bi bi-${section.icon}`} /></span>
                <span><strong>{section.title}</strong><small>{section.pages.length} page{section.pages.length === 1 ? "" : "s"}</small></span>
                <i className="bi bi-chevron-down guide-section-chevron" />
              </summary>
              <div className="guide-section-body">
                {section.intro && <p className="guide-section-intro">{section.intro}</p>}
                <div className="guide-page-list">
                  {section.pages.map((page) => {
                    const fields = pageFields(page);
                    const actions = pageActions(page);
                    const routeCanOpen = page.route && !page.route.includes("[");
                    return (
                      <article className="guide-page-card" key={`${section.id}-${page.title}-${page.route || "component"}`}>
                        <div className="guide-page-heading">
                          <div>
                            <span className="guide-page-kicker">{section.title}</span>
                            <h3>{page.title}</h3>
                          </div>
                          <span className="guide-permission" title="Permission resource"><i className="bi bi-key" /> {page.permission}</span>
                        </div>

                        {page.route && (
                          <div className="guide-route-row">
                            <code>{page.route}</code>
                            <div>
                              <button type="button" onClick={() => void copyRoute(page.route!)} title="Copy route" aria-label={`Copy ${page.route}`}>
                                <i className={`bi ${copiedRoute === page.route ? "bi-check2" : "bi-copy"}`} />
                              </button>
                              {routeCanOpen && <Link href={page.route} title={`Open ${page.title}`} aria-label={`Open ${page.title}`}><i className="bi bi-box-arrow-up-right" /></Link>}
                            </div>
                          </div>
                        )}

                        <p className="guide-page-summary">{page.summary}</p>
                        <div className="guide-audience"><i className="bi bi-eye" /><span><b>Who can see it:</b> {page.audience || (page.permission === "Public" ? "Everyone" : `Users granted ${page.permission} view permission`)}</span></div>

                        {actions.length > 0 && (
                          <div className="guide-card-block">
                            <h4><i className="bi bi-lightning-charge" /> Main actions &amp; widgets</h4>
                            <div className="guide-chip-list">{actions.map((action) => <span key={action}>{action}</span>)}</div>
                          </div>
                        )}

                        {fields.length > 0 && (
                          <div className="guide-card-block">
                            <h4><i className="bi bi-ui-checks-grid" /> Fields &amp; displayed data</h4>
                            <ul className="guide-field-list">{fields.map((field) => <li key={field}>{field}</li>)}</ul>
                          </div>
                        )}

                        {page.note && <div className="guide-note"><i className="bi bi-info-circle" /><span>{page.note}</span></div>}
                      </article>
                    );
                  })}
                </div>
                {section.id === "shared-ui" && (
                  <div className="guide-components-table">
                    <table>
                      <thead><tr><th>Component</th><th>Purpose</th></tr></thead>
                      <tbody>{GUIDE_COMPONENTS.map(([name, purpose]) => <tr key={name}><td><code>{name}</code></td><td>{purpose}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
                <a href="#user-guide-top" className="guide-back-top">Back to top <i className="bi bi-arrow-up" /></a>
              </div>
            </details>
          ))}
        </main>
      </div>
    </div>
  );
}
