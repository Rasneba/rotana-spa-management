"use client";

import { Link, useRouter, usePathname } from "@/lib/i18n/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useLanguage } from "@/lib/i18n/LocaleProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { sidebarGroups } from "@/lib/spa-navigation";

const toNavSlug = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const NAVIGATION_STORAGE_VERSION = "3";

const activeGroupForPath = (path: string) => {
  let match: { name: string; hrefLength: number; direct?: boolean } | null = null;
  for (const group of sidebarGroups) {
    for (const link of group.links) {
      const matches = path === link.href || (link.href !== "/dashboard" && path.startsWith(`${link.href}/`));
      if (matches && (!match || link.href.length > match.hrefLength)) {
        match = { name: group.name, hrefLength: link.href.length, direct: group.direct };
      }
    }
  }
  return match;
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { t } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [licensedModules, setLicensedModules] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean[]>>({});
  const searchRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved === "true") setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      router.push("/login");
    } else {
      const u = JSON.parse(stored);
      setUser(u);
      const role = (u.role || "").toLowerCase();
      // Fetch role permissions for navigation filtering.
      if (role !== "admin" && role !== "super_admin" && u.role_id) {
        const tok = localStorage.getItem("token");
        fetch(`/api/roles/${u.role_id}/permissions`, { headers: { Authorization: `Bearer ${tok}` } })
          .then(r => r.json())
          .then(data => {
            if (data && typeof data === "object") {
              setUserPermissions(data);
              // Guests start on the first workspace explicitly granted to them.
              if (role === "guest" && pathname === "/dashboard") {
                for (const group of sidebarGroups) {
                  for (const link of group.links) {
                    if (data[link.resource]?.[0]) {
                      router.push(link.href);
                      return;
                    }
                  }
                }
              }
            }
          })
          .catch(() => {});
      }
      if (u.company_id) {
        const tok = localStorage.getItem("token");
        fetch(`/api/companies/${u.company_id}`, { headers: { Authorization: `Bearer ${tok}` } })
          .then(r => r.json())
          .then(data => {
            if (data?.modules && Array.isArray(data.modules)) {
              setLicensedModules(data.modules.filter((m: any) => m.enabled).map((m: any) => m.code));
            }
          })
          .catch(() => {});
      }
    }
    const defaultGroups = Object.fromEntries(
      sidebarGroups.map((group) => [group.name, false])
    ) as Record<string, boolean>;
    const activeGroup = activeGroupForPath(pathname);
    if (activeGroup && !activeGroup.direct) defaultGroups[activeGroup.name] = true;

    const saved = localStorage.getItem("sidebarGroups");
    const savedVersion = localStorage.getItem("sidebarGroupsVersion");
    if (saved && savedVersion === NAVIGATION_STORAGE_VERSION) {
      try {
        const storedGroups = JSON.parse(saved) as Record<string, boolean>;
        const nextGroups = { ...defaultGroups, ...storedGroups };
        if (activeGroup && !activeGroup.direct) nextGroups[activeGroup.name] = true;
        setOpenGroups(nextGroups);
      } catch {
        setOpenGroups(defaultGroups);
      }
    } else {
      setOpenGroups(defaultGroups);
    }
    localStorage.setItem("sidebarGroupsVersion", NAVIGATION_STORAGE_VERSION);
  }, [router]);

  useEffect(() => {
    if (Object.keys(openGroups).length > 0) {
      localStorage.setItem("sidebarGroups", JSON.stringify(openGroups));
    }
  }, [openGroups]);

  useEffect(() => {
    const activeGroup = activeGroupForPath(pathname);
    if (!activeGroup || activeGroup.direct) return;
    setOpenGroups((current) => current[activeGroup.name]
      ? current
      : { ...current, [activeGroup.name]: true });
  }, [pathname]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }
    const timer = setTimeout(async () => {
      const tok = localStorage.getItem("token");
      if (!tok) return;
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        const data = await res.json();
        if (Array.isArray(data)) setSearchResults(data);
        else if (data?.results) setSearchResults(data.results);
        else setSearchResults([]);
        setShowSearch(true);
      } catch { setSearchResults([]); }
      setSearchLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleGroup = (name: string) => {
    setOpenGroups(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === "/dashboard" || !pathname.startsWith(`${href}/`)) return false;

    // Keep overview links from appearing active when a more specific spa
    // workspace owns the current path.
    const hasMoreSpecificMatch = sidebarGroups.some((group) =>
      group.links.some((link) => link.href !== href && link.href.length > href.length &&
        (pathname === link.href || pathname.startsWith(`${link.href}/`)))
    );
    return !hasMoreSpecificMatch;
  };

  const groupedResults = searchResults.reduce((acc: any, item: any) => {
    const type = item.type || item._type || "General";
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "?";

  const translatedLabel = (key: string, fallback: string): string => {
    const label = t(key);
    return label !== key ? label : fallback;
  };

  const groupKey = (group: string): string => `nav.group.${toNavSlug(group)}`;
  const navKey = (group: string, link: string): string =>
    group === "Dashboard" && link === "Dashboard"
      ? "nav.dashboard"
      : `nav.${toNavSlug(group)}.${toNavSlug(link)}`;

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isSuper = user?.role === "super_admin";

  const hasPermission = (resource: string): boolean => {
    if (isAdmin) return true;
    const perms = userPermissions[resource];
    if (!perms) return false;
    return perms[0] === true; // can_view is index 0
  };

  const visibleGroups = sidebarGroups.filter((group) => {
    if (group.adminOnly && !isAdmin) return false;
    if (group.superAdminOnly && !isSuper) return false;
    if (group.moduleCode && !licensedModules.includes(group.moduleCode) && !isSuper) return false;
    return true;
  }).map((group) => ({
    ...group,
    links: group.links.filter((link) => {
      if (link.adminOnly && !isAdmin) return false;
      if (link.superAdminOnly && !isSuper) return false;
      if (user && !isAdmin && !hasPermission(link.resource)) return false;
      return true;
    }),
  })).filter((group) => group.links.length > 0);

  const pageTitle = (() => {
    if (pathname === "/dashboard/membership") return translatedLabel("nav.group.spa_management", "Spa Management");
    for (const group of sidebarGroups) {
      for (const link of group.links) {
        if (link.adminOnly && !isAdmin) continue;
        if (link.superAdminOnly && !isSuper) continue;
        if (isActive(link.href)) {
          const linkLabel = translatedLabel(navKey(group.name, link.name), link.name);
          return group.direct
            ? linkLabel
            : `${translatedLabel(groupKey(group.name), group.name)} / ${linkLabel}`;
        }
      }
    }
    return "Workspace";
  })();

  return (
    <div className="page">
      {/* Sidebar Overlay (mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "show" : ""}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`page-sidebar ${sidebarOpen ? "show" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}
      >
        {/* Sidebar Brand */}
        <div className="sidebar-brand">
          <div
            className="d-flex align-items-center justify-content-center rounded"
            style={{ width: "32px", height: "32px", background: "var(--accent-gradient)", flexShrink: 0 }}
          >
            <i className="bi bi-grid-fill text-white" style={{ fontSize: "16px" }}></i>
          </div>
          <span className="fw-bold gradient-text" style={{ fontSize: "1rem" }}>Rotana Spa</span>
        </div>

        {/* Company Info */}
        {user?.company_name && (
          <div className="px-3 py-1 text-center" style={{ fontSize: "10px", color: "var(--text-tertiary)", lineHeight: 1.3 }}>
            <div className="fw-semibold text-truncate">{user.company_name}</div>
          </div>
        )}

        {/* Sidebar Navigation */}
        <nav className="sidebar-nav" aria-label="Spa management navigation">
          {visibleGroups.map((group) => {
            if (group.direct) {
              const link = group.links[0];
              const label = translatedLabel(navKey(group.name, link.name), link.name);
              return (
                <div key={group.name} className="sidebar-group sidebar-direct-group">
                  <Link
                    href={link.href}
                    className={`sidebar-link sidebar-direct-link ${isActive(link.href) ? "active" : ""}`}
                    onClick={closeSidebar}
                    title={label}
                  >
                    <i className={`bi ${link.icon}`}></i>
                    <span className="flex-grow-1 text-truncate">{label}</span>
                  </Link>
                </div>
              );
            }

            return (
              <div key={group.name} className="sidebar-group">
                <button
                  type="button"
                  className={`sidebar-group-label ${group.links.some((link) => isActive(link.href)) ? "has-active-link" : ""}`}
                  onClick={() => toggleGroup(group.name)}
                  aria-expanded={Boolean(openGroups[group.name])}
                  aria-controls={`sidebar-group-${toNavSlug(group.name)}`}
                  title={translatedLabel(groupKey(group.name), group.name)}
                >
                  <span className="d-flex align-items-center gap-2">
                    <i className={`bi ${group.icon} sidebar-group-symbol`}></i>
                    <span className="group-text">{translatedLabel(groupKey(group.name), group.name)}</span>
                  </span>
                  <i className={`bi bi-chevron-down sidebar-group-icon ${openGroups[group.name] ? "open" : ""}`}></i>
                </button>
                {openGroups[group.name] && (
                  <div id={`sidebar-group-${toNavSlug(group.name)}`} className="ms-1">
                    {group.links.map((link) => {
                      const label = translatedLabel(navKey(group.name, link.name), link.name);
                      if (link.target === "_blank") {
                        return (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`sidebar-link ${isActive(link.href) ? "active" : ""}`}
                            title={label}
                          >
                            <i className={`bi ${link.icon}`}></i>
                            <span className="flex-grow-1 text-truncate">{label}</span>
                            <i className="bi bi-box-arrow-up-right link-arrow" style={{ fontSize: "10px", opacity: 0.5 }}></i>
                          </a>
                        );
                      }
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`sidebar-link ${isActive(link.href) ? "active" : ""}`}
                          onClick={closeSidebar}
                          title={label}
                        >
                          <i className={`bi ${link.icon}`}></i>
                          <span className="flex-grow-1 text-truncate">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar User */}
        <div className="sidebar-user">
          <div
            className="d-flex align-items-center justify-content-center rounded-circle fw-bold text-white"
            style={{ width: "36px", height: "36px", fontSize: "14px", flexShrink: 0, background: "var(--accent-gradient)" }}
          >
            {userInitial}
          </div>
          <div className="small text-truncate flex-grow-1 user-info">
            <div className="fw-semibold text-truncate" style={{ color: "var(--text-primary)" }}>{user?.name || "User"}</div>
            <div className="text-truncate" style={{ color: "var(--text-tertiary)", fontSize: "11px" }}>{user?.email}</div>
            <span className="badge mt-1" style={{ fontSize: "10px", background: "var(--accent-gradient)" }}>{user?.role || "User"}</span>
          </div>
        </div>
      </aside>

      {/* Page Wrapper */}
      <div className="page-wrapper">
        {/* Header */}
        <header className="page-header">
          <div className="container-fluid d-flex align-items-center justify-content-between h-100 px-3">
            <div className="d-flex align-items-center gap-3">
              {/* Mobile sidebar toggle */}
              <button
                className="sidebar-toggle d-md-none"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle sidebar"
              >
                <i className="bi bi-list fs-5"></i>
              </button>

              {/* Desktop collapse toggle */}
              <button
                className="sidebar-toggle d-none d-md-flex sidebar-collapse-btn"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <i className={`bi ${sidebarCollapsed ? "bi-text-left" : "bi-text-indent-left"} fs-5`}></i>
              </button>

              {/* Page title */}
              <h5 className="mb-0 fw-semibold d-flex align-items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <span
                  style={{
                    width: "4px",
                    height: "20px",
                    borderRadius: "2px",
                    background: "var(--accent-gradient)",
                    display: "inline-block",
                  }}
                ></span>
                {pageTitle}
              </h5>

              {/* Global search */}
              <div ref={searchRef} className="d-none d-md-block" style={{ position: "relative" }}>
                <div className="input-group input-group-sm" style={{ maxWidth: "320px" }}>
                  <span className="input-group-text border-end-0">
                    <i className="bi bi-search" style={{ color: "var(--muted)" }}></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => { if (searchResults.length > 0) setShowSearch(true); }}
                  />
                </div>
                {showSearch && searchQuery.trim() && (
                  <div
                    className="position-absolute border shadow rounded-3 mt-1 search-result-enter"
                    style={{
                      width: "400px",
                      right: 0,
                      zIndex: 1050,
                      maxHeight: "480px",
                      overflowY: "auto",
                      backgroundColor: "var(--card-bg)",
                      borderColor: "var(--card-border)",
                    }}
                  >
                    {searchLoading ? (
                      <div className="p-3 text-center">
                        <div className="spinner-border spinner-border-sm" style={{ color: "var(--accent-sky)" }} role="status"></div>
                        <span className="ms-2 small" style={{ color: "var(--text-tertiary)" }}>Searching...</span>
                      </div>
                    ) : Object.keys(groupedResults).length === 0 ? (
                      <div className="p-3 text-center small" style={{ color: "var(--text-tertiary)" }}>No results found</div>
                    ) : (
                      Object.entries(groupedResults).map(([type, items]: [string, any]) => (
                        <div key={type}>
                          <div
                            className="px-3 py-2 fw-bold text-uppercase small"
                            style={{ color: "var(--accent-sky)", backgroundColor: "var(--table-hover)" }}
                          >
                            {type}
                          </div>
                          {(items as any[]).map((item: any, idx: number) => (
                            <Link
                              key={idx}
                              href={item.href || item.link || "#"}
                              className="d-flex align-items-center gap-3 px-3 py-2 text-decoration-none"
                              style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--card-border)" }}
                              onClick={() => setShowSearch(false)}
                            >
                              <div>
                                <div className="fw-semibold small">{item.name || item.title || item.label}</div>
                                <div className="small" style={{ color: "var(--text-tertiary)" }}>{item.subtitle || item.description || ""}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Header right */}
            <div className="d-flex align-items-center gap-2">
              <LanguageSwitcher />

              {/* Theme toggle */}
              <button
                onClick={toggle}
                className="theme-toggle"
                title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              >
                <i className={`bi ${theme === "light" ? "bi-moon-stars" : "bi-sun"} fs-5`}></i>
              </button>

              {/* Help & notifications */}
              <div className="d-none d-md-flex gap-1">
                <Link href="/dashboard/guide" className="theme-toggle" title="User Guide" aria-label="Open user guide">
                  <i className="bi bi-question-circle fs-5"></i>
                </Link>
                <Link href="/dashboard/notifications" className="theme-toggle" title="Notifications" aria-label="Open notifications">
                  <i className="bi bi-bell fs-5"></i>
                </Link>
              </div>

              {/* User info */}
              <div className="d-none d-sm-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle text-white fw-bold"
                  style={{ width: "32px", height: "32px", fontSize: "12px", background: "var(--accent-gradient)" }}
                >
                  {userInitial}
                </div>
                <div className="small text-end d-none d-lg-block">
                  <div className="fw-semibold" style={{ color: "var(--text-primary)" }}>{user?.name || "User"}</div>
                  <div style={{ color: "var(--text-tertiary)", fontSize: "11px" }}>
                    {user?.email} {user?.branch_name && <span className="ms-1">| {user.branch_name}</span>}
                  </div>
                </div>
                <span className="badge d-none d-lg-inline-block" style={{ background: "var(--accent-gradient)" }}>
                  {user?.role || "User"}
                </span>
              </div>

              {/* Logout */}
              <button onClick={logout} className="btn btn-outline-danger btn-sm px-3 d-none d-sm-flex">
                <i className="bi bi-box-arrow-right me-1"></i>
                Logout
              </button>

              {/* Mobile logout */}
              <button onClick={logout} className="btn btn-outline-danger btn-sm p-1 d-sm-none" title="Logout">
                <i className="bi bi-box-arrow-right fs-6"></i>
              </button>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <div className="page-body page-enter">
          {children}
        </div>
      </div>
    </div>
  );
}
