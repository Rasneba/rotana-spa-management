"use client";
import { useEffect, useState } from "react";
import { GemPage, GemHeader, GemCard, GemCardBare, GemBtn, GemBtnOutline, GemBadge, GemInput, GemSelect } from "@/lib/gem-ui";
import { Settings, Building2, Database, FileText, GitBranch, Users, Wallet, CheckCircle, XCircle, Loader2, Save, ExternalLink, Shield, BookOpen } from "lucide-react";

const TABS = [
  { id: "company", label: "Company & System Configuration", icon: Building2 },
  { id: "system", label: "System Information", icon: Database },
  { id: "quick", label: "Quick Links", icon: ExternalLink },
];

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState("company");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [dbStatus, setDbStatus] = useState("Checking...");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    const load = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const sRes = await fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } });
        const sData = await sRes.json();
        if (sData && !sData.error) setSettings(sData);
      } catch {}
      try {
        const dbRes = await fetch("/api/health", { headers: { Authorization: `Bearer ${token}` } });
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          setDbStatus(dbData?.database === "connected" ? "Connected" : "Disconnected");
        } else { setDbStatus("Disconnected"); }
      } catch { setDbStatus("Disconnected"); }
      setLoading(false);
    };
    load();
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch {}
    setSaving(false);
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const quickLinks = [
    { label: "Branch Management", desc: "Manage company branches and locations.", href: "/dashboard/branches", icon: GitBranch, color: "bg-blue-500" },
    { label: "User Management", desc: "Manage system users, roles, and permissions.", href: "/dashboard/users", icon: Users, color: "bg-emerald-500" },
    { label: "Payroll & Tax", desc: "Manage payroll periods, pension settings, and tax brackets.", href: "/dashboard/payroll", icon: Wallet, color: "bg-purple-500" },
    { label: "Document Templates", desc: "Manage document templates and generate documents.", href: "/dashboard/documents", icon: FileText, color: "bg-amber-500" },
    { label: "Roles & Permissions", desc: "Configure role-based access control for the system.", href: "/dashboard/roles", icon: Shield, color: "bg-red-500" },
    { label: "Manuals & Guides", desc: "Access system documentation and relay setup guides.", href: "/dashboard/admin/manuals", icon: BookOpen, color: "bg-cyan-500" },
  ];

  return (
    <GemPage>
      <GemHeader
        title="System Settings"
        subtitle="Company configuration, system information, and quick access"
        actions={
          activeTab === "company" ? (
            <GemBtn onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle size={15} /> : <Save size={15} />}
              {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
            </GemBtn>
          ) : undefined
        }
      />

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-black text-black"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "company" && (
        <GemCard>
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Building2 size={18} /> Company & System Configuration
          </h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-1.5 block">Company Name</label>
                <GemInput value={settings.company_name || ""} onChange={e => updateSetting("company_name", e.target.value)} placeholder="Rotana Spa" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-1.5 block">Company Address</label>
                <GemInput value={settings.company_address || ""} onChange={e => updateSetting("company_address", e.target.value)} placeholder="123 Business Street" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-1.5 block">Company Phone</label>
                <GemInput value={settings.company_phone || ""} onChange={e => updateSetting("company_phone", e.target.value)} placeholder="+251-XX-XXX-XXXX" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-1.5 block">Company Email</label>
                <GemInput value={settings.company_email || ""} onChange={e => updateSetting("company_email", e.target.value)} placeholder="info@rotanaspa.com" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-1.5 block">Currency</label>
                <GemSelect value={settings.currency || "Birr"} onChange={e => updateSetting("currency", e.target.value)}>
                  <option value="Birr">Birr</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </GemSelect>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-1.5 block">Tax Rate (%)</label>
                <GemInput type="number" value={settings.tax_rate || "15"} onChange={e => updateSetting("tax_rate", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-1.5 block">Payroll Frequency</label>
                <GemSelect value={settings.payroll_frequency || "monthly"} onChange={e => updateSetting("payroll_frequency", e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="quarterly">Quarterly</option>
                </GemSelect>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600 mb-1.5 block">Working Days per Month</label>
                <GemInput type="number" value={settings.working_days || "22"} onChange={e => updateSetting("working_days", e.target.value)} />
              </div>
            </div>
          )}
        </GemCard>
      )}

      {activeTab === "system" && (
        <GemCard>
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Database size={18} /> System Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-700">Database Status</p>
                <p className="text-xs text-gray-400 mt-1">PostgreSQL (Neon)</p>
              </div>
              {dbStatus === "Connected" ? (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <CheckCircle size={16} /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-red-500">
                  <XCircle size={16} /> {dbStatus}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-700">App Version</p>
                <p className="text-xs text-gray-400 mt-1">Runtime & framework</p>
              </div>
              <span className="text-sm font-mono text-gray-600">v0.1.0</span>
            </div>
            <div className="md:col-span-2 p-4 bg-gray-50 rounded-xl">
              <p className="text-sm font-semibold text-gray-700 mb-2">Tech Stack</p>
              <div className="flex flex-wrap gap-2">
                {["Next.js 16", "React 19", "Bootstrap 5", "Tailwind CSS", "PostgreSQL", "Node.js", "pm2"].map(t => (
                  <GemBadge key={t} variant="info">{t}</GemBadge>
                ))}
              </div>
            </div>
          </div>
        </GemCard>
      )}

      {activeTab === "quick" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map(link => {
            const Icon = link.icon;
            return (
              <a
                key={link.href}
                href={link.href}
                className="flex items-start gap-4 p-5 bg-white border border-gray-100 rounded-xl hover:shadow-md hover:border-gray-200 transition-all group"
              >
                <div className={`p-2.5 rounded-xl ${link.color} text-white flex-shrink-0`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-gray-800 group-hover:text-black">{link.label}</h4>
                  <p className="text-xs text-gray-400 mt-1">{link.desc}</p>
                </div>
                <ExternalLink size={14} className="text-gray-300 group-hover:text-gray-500 mt-1 flex-shrink-0" />
              </a>
            );
          })}
        </div>
      )}
    </GemPage>
  );
}
