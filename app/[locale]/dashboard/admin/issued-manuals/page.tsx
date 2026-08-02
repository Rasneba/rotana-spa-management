"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const moduleDocs: Record<string, { name: string; icon: string; description: string; docs: { title: string; href?: string; content?: string }[] }> = {
  hrms: {
    name: "HRMS", icon: "bi-people",
    description: "Manage employees, attendance, leave, payroll, and HR operations",
    docs: [
      { title: "Employee Management", content: "Add, edit, view employee profiles including personal info, documents, education, experience, and bank details." },
      { title: "Attendance & Shifts", content: "Track employee attendance, manage shifts, overtime requests, and ZKTeco biometric integration." },
      { title: "Leave Management", content: "Configure leave types, submit and approve leave requests with balance tracking." },
      { title: "Payroll Processing", content: "Run payroll cycles, manage PAYE tax brackets, pension contributions, and generate payslips." },
      { title: "Performance & Clearance", content: "Employee performance reviews, clearance workflows, and termination processing." },
    ],
  },
  sales: {
    name: "Sales", icon: "bi-cart3",
    description: "Manage customers, quotations, orders, invoices, and point of sale",
    docs: [
      { title: "Customer Management", content: "Maintain customer database with contact details and transaction history." },
      { title: "Quotations", content: "Create and manage price quotes for customers." },
      { title: "Sales Orders", content: "Process customer orders from quotation to fulfillment." },
      { title: "Invoices", content: "Generate and manage invoices with payment tracking." },
      { title: "POS", content: "Point of sale interface for retail transactions." },
    ],
  },
  stock: {
    name: "Stock", icon: "bi-box-seam",
    description: "Inventory management, warehouses, stock movements and adjustments",
    docs: [
      { title: "Inventory Management", content: "Track stock items with categories, units, and reorder levels." },
      { title: "Warehouses", content: "Manage multiple warehouse locations and stock distribution." },
      { title: "Stock Movements", content: "Record stock in/out transactions with reference tracking." },
      { title: "Adjustments & Transfers", content: "Stock count adjustments and inter-warehouse transfers." },
    ],
  },
  finance: {
    name: "Finance", icon: "bi-cash-stack",
    description: "Chart of accounts, journal entries, ledger, payments and budgeting",
    docs: [
      { title: "Chart of Accounts", content: "Configure your chart of accounts structure." },
      { title: "Journal Entries", content: "Record financial transactions in the general journal." },
      { title: "Ledger", content: "View general ledger with account balances and transaction history." },
      { title: "Payments", content: "Manage incoming and outgoing payments." },
      { title: "Budget Management", content: "Set and track departmental budgets." },
      { title: "Vouchers", content: "Create and manage payment vouchers with approval workflow." },
    ],
  },
  production: {
    name: "Production", icon: "bi-gear",
    description: "Bill of materials, work orders, and production routings",
    docs: [
      { title: "Bill of Materials", content: "Define product BOMs with raw materials and quantities." },
      { title: "Work Orders", content: "Create and track production work orders." },
      { title: "Routings", content: "Define production routings with work centers and steps." },
    ],
  },
  procurement: {
    name: "Procurement", icon: "bi-truck",
    description: "Supplier management, purchase orders, and RFQ processing",
    docs: [
      { title: "Supplier Management", content: "Maintain supplier database with contact and payment terms." },
      { title: "Purchase Orders", content: "Create and manage purchase orders to suppliers." },
      { title: "RFQ", content: "Request for quotations from multiple suppliers." },
      { title: "Purchase Returns", content: "Process returns to suppliers with credit tracking." },
    ],
  },
  ecommerce: {
    name: "E-Commerce", icon: "bi-shop",
    description: "Online store products, orders, and customer management",
    docs: [
      { title: "Product Catalog", content: "Manage online store products with images and pricing." },
      { title: "Online Orders", content: "Process incoming orders from the online store." },
      { title: "Online Customers", content: "Manage e-commerce customer profiles." },
    ],
  },
  membership: {
    name: "Spa Management", icon: "bi-flower1",
    description: "Customer visits, appointments, treatments, inventory and draft service-order handoff",
    docs: [
      { title: "Canonical Masters", content: "Create each person once in Customer & Member Master. Classify plans, services and packages in the single Offering Master. Pricing and payment remain in the separate POS." },
      { title: "Visit & Treatment Workflow", content: "Check in customers, assign therapists, start treatment and record every service used." },
      { title: "Service Order Draft", content: "Finish treatment and print an 80 mm price-free service order for the customer to take to the separate cashier." },
      { title: "System Boundary", content: "The Spa system never calculates tax, accepts payment, creates invoices, or connects to the Sales/POS database." },
    ],
  },
  audit: {
    name: "Audit", icon: "bi-journal-text",
    description: "System audit logs and activity monitoring",
    docs: [
      { title: "Audit Logs", content: "View system-wide audit trails of user activities." },
      { title: "Activity Monitoring", content: "Monitor user activity and system changes." },
    ],
  },
  reports: {
    name: "Reports", icon: "bi-bar-chart",
    description: "Generate and view business reports and analytics",
    docs: [
      { title: "Reports Dashboard", content: "Generate and export business intelligence reports." },
      { title: "Documents", content: "Generate documents from templates (letters, certificates)." },
    ],
  },
};

export default function IssuedManualsPage() {
  const [licensedCodes, setLicensedCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const tok = localStorage.getItem("token");
    if (!stored || !tok) { setLoading(false); return; }

    const u = JSON.parse(stored);
    if (u.company_id) {
      fetch(`/api/companies/${u.company_id}`, { headers: { Authorization: `Bearer ${tok}` } })
        .then(r => r.json())
        .then(data => {
          if (data?.modules && Array.isArray(data.modules)) {
            setLicensedCodes(data.modules.filter((m: any) => m.enabled).map((m: any) => m.code));
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const licensedDocs = Object.entries(moduleDocs).filter(([code]) => licensedCodes.includes(code));

  return (
    <div className="page-enter">
      <div className="mb-4">
        <h4 className="fw-bold mb-1"><i className="bi bi-journal-bookmark-fill me-2"></i>Issued Licensed Manuals</h4>
        <p className="text-muted small mb-0">Module documentation for your licensed modules</p>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>
      ) : licensedDocs.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-inbox fs-1 d-block mb-2"></i>
          <p>No licensed modules found. Contact your system administrator.</p>
        </div>
      ) : (
        <div className="row g-4">
          {licensedDocs.map(([code, mod]) => (
            <div key={code} className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-header d-flex align-items-center gap-2">
                  <i className={`bi ${mod.icon} fs-5 text-primary`}></i>
                  <span className="fw-semibold">{mod.name} Module</span>
                </div>
                <div className="card-body">
                  <p className="text-muted small mb-3">{mod.description}</p>
                  <div className="list-group list-group-flush">
                    {mod.docs.map((doc, i) => (
                      <div key={i} className="list-group-item px-0">
                        <div className="d-flex align-items-start gap-2">
                          <i className="bi bi-file-text text-primary mt-1"></i>
                          <div>
                            <div className="fw-semibold small">{doc.title}</div>
                            <div className="text-muted small">{doc.content}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
