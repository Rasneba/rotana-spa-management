"use client";

import { useState } from "react";

const sections = [
  { id: "overview", label: "System Overview", icon: "bi-info-circle" },
  { id: "login", label: "Login & Access", icon: "bi-box-arrow-in-right" },
  { id: "implementation", label: "Implementation Guide", icon: "bi-gear" },
  { id: "developer", label: "Developer Guide", icon: "bi-code-slash" },
  { id: "dashboard", label: "Dashboard", icon: "bi-speedometer2" },
  { id: "access-control", label: "Spa & Gym Access", icon: "bi-shield-check" },
  { id: "hrms", label: "HRMS Module", icon: "bi-people" },
  { id: "stock", label: "Stock Module", icon: "bi-boxes" },
  { id: "sales", label: "Sales Module", icon: "bi-cart" },
  { id: "finance", label: "Finance Module", icon: "bi-wallet2" },
  { id: "procurement", label: "Procurement Module", icon: "bi-truck" },
  { id: "production", label: "Production Module", icon: "bi-gear" },
  { id: "ecommerce", label: "E-Commerce Module", icon: "bi-shop" },
  { id: "payroll", label: "Payroll", icon: "bi-calculator" },
  { id: "selfservice", label: "Self Service", icon: "bi-person-badge" },
  { id: "admin", label: "Administration", icon: "bi-shield-lock" },
  { id: "faq", label: "FAQ", icon: "bi-question-circle" },
];

export default function ManualsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const Section = ({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) => (
    <div id={id} className="mb-5">
      <h5 className="fw-bold mb-3 pb-2 border-bottom">{title}</h5>
      {children}
    </div>
  );

  const Step = ({ num, text }: { num: number; text: string }) => (
    <div className="d-flex gap-2 mb-2">
      <span className="badge bg-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: 24, height: 24, minWidth: 24 }}>{num}</span>
      <span>{text}</span>
    </div>
  );

  const Note = ({ children }: { children: React.ReactNode }) => (
    <div className="alert alert-info py-2 small mb-3">
      <i className="bi bi-info-circle me-1"></i>{children}
    </div>
  );

  return (
    <div className="page-enter">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1"><i className="bi bi-journal-bookmark-fill me-2"></i>User Manual & Guide</h4>
          <p className="text-muted small mb-0">Complete documentation for Genius ERP system</p>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-3">
          <div className="card border-0 shadow-sm position-sticky" style={{ top: "20px" }}>
            <div className="card-header fw-semibold small">Table of Contents</div>
            <div className="list-group list-group-flush" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              {sections.map((s) => (
                <button
                  key={s.id}
                  className={`list-group-item list-group-item-action d-flex align-items-center gap-2 border-0 small ${activeSection === s.id ? "active" : ""}`}
                  onClick={() => scrollTo(s.id)}
                >
                  <i className={`bi ${s.icon}`}></i>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-9">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">

              <Section id="overview" title="1. System Overview">
                <p><strong>Genius ERP</strong> is a comprehensive Enterprise Resource Planning system designed for Ethiopian businesses. It integrates all core business functions into a single platform with multi-company (tenant) support.</p>
                <div className="row g-3 my-2">
                  <div className="col-md-4">
                    <div className="border rounded-3 p-3 text-center h-100">
                      <i className="bi bi-building fs-2 text-primary d-block mb-1"></i>
                      <strong>Multi-Tenant</strong>
                      <div className="small text-muted">Each company sees only its own data</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="border rounded-3 p-3 text-center h-100">
                      <i className="bi bi-module fs-2 text-success d-block mb-1"></i>
                      <strong>Modular</strong>
                      <div className="small text-muted">9 modules licensed per-company</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="border rounded-3 p-3 text-center h-100">
                      <i className="bi bi-translate fs-2 text-info d-block mb-1"></i>
                      <strong>Bilingual</strong>
                      <div className="small text-muted">English & Amharic supported</div>
                    </div>
                  </div>
                </div>
                <p className="mt-2"><strong>Available Modules:</strong> HRMS, Payroll, Stock/Inventory, Sales, Finance, Procurement, Production, E-Commerce, Audit & Reports.</p>
              </Section>

              <Section id="login" title="2. Login & Access">
                <h6 className="fw-semibold">How to Log In</h6>
                <Step num={1} text="Navigate to the login page at the system URL" />
                <Step num={2} text="Enter your Company TIN (Tax Identification Number) — e.g., TIN-000001" />
                <Step num={3} text="Enter your Email address and Password" />
                <Step num={4} text="Click the <strong>Sign In</strong> button" />
                <Note>Your Company TIN is provided by your system administrator. The default demo company uses TIN: <code>TIN-000001</code>.</Note>

                <h6 className="fw-semibold mt-3">User Roles</h6>
                <div className="table-responsive">
                  <table className="table table-sm table-bordered">
                    <thead className="table-dark">
                      <tr>
                        <th>Role</th>
                        <th>Permissions</th>
                        <th>Access</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="badge bg-danger">Super Admin</span></td>
                        <td>Full system access, all companies, all modules</td>
                        <td>Administration panel, all data</td>
                      </tr>
                      <tr>
                        <td><span className="badge bg-primary">Admin</span></td>
                        <td>Company-level admin, manage users and settings</td>
                        <td>Administration panel, module management</td>
                      </tr>
                      <tr>
                        <td><span className="badge bg-secondary">Employee</span></td>
                        <td>Self-service only: attendance, leave, profile</td>
                        <td>Self Service portal</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section id="implementation" title="Implementation Guide">
                <p className="lead">Step-by-step walkthrough to onboard a new company, issue module licenses, and grant user access.</p>

                <h6 className="fw-semibold mt-4">Step 1 — Register the Company</h6>
                <ol>
                  <li>Go to <strong>Administration → Companies</strong> and click <span className="badge bg-success">+ Add Company</span>.</li>
                  <li>Enter the company name, TIN (Tax Identification Number), contact details, and address.</li>
                  <li>A default TIN format is <code>TIN-XXXXXX</code>. Each TIN must be unique in the system.</li>
                  <li>Save the company — it will appear in the companies list with a user count of 0.</li>
                  <li>Alternatively, skip this step and let <strong>Step 2</strong> auto-create the company when you issue its first license.</li>
                </ol>

                <h6 className="fw-semibold mt-4">Step 2 — Issue a License</h6>
                <p>Licenses control which modules a company can access. Two methods:</p>

                <p className="fw-semibold mb-1">Method A: Demo License (Quick Start)</p>
                <ol>
                  <li>Go to <strong>Administration → Demo Licenses</strong> and click <span className="badge bg-success">+ Issue Demo License</span>.</li>
                  <li>Enter the company TIN. If the company does not already exist, check <strong>Auto-create company</strong> to register it automatically.</li>
                  <li>Select which modules to enable: <strong>HRMS</strong>, <strong>Stock</strong>, <strong>Sales</strong>, <strong>Finance</strong>, <strong>Procurement</strong>, <strong>Production</strong> (check all that apply).</li>
                  <li>Pick a duration (e.g. 30, 60, 90 days) or set an explicit expiry date.</li>
                  <li>Submit — the license is created and the company can now log in.</li>
                  <li>A company can have multiple licenses over time (e.g. a trial followed by a paid renewal).</li>
                </ol>

                <p className="fw-semibold mb-1">Method B: Direct Company Module Assignment</p>
                <ol>
                  <li>Go to <strong>Administration → Companies</strong> and click the company name.</li>
                  <li>In the company detail view, assign individual modules via the module checklist.</li>
                  <li>This gives permanent access (no expiry) — useful for paid subscriptions.</li>
                </ol>

                <h6 className="fw-semibold mt-4">Step 3 — Create a Company Admin User</h6>
                <ol>
                  <li>Go to <strong>Administration → Users</strong> and click <span className="badge bg-success">+ Add User</span>.</li>
                  <li>Provide: full name, email address, phone number, and a temporary password.</li>
                  <li>Select the target company from the <strong>Company</strong> dropdown (shows name + TIN).</li>
                  <li>Assign the role <span className="badge bg-primary">Admin</span> — this gives full company-level access.</li>
                  <li>Save — the admin can now log in and manage their company's data.</li>
                </ol>

                <h6 className="fw-semibold mt-4">Step 3b — Create a Direct Employee User</h6>
                <ol>
                  <li>Follow the same steps as Step 3, but assign the role <span className="badge bg-secondary">Employee</span>.</li>
                  <li>This creates a user who can log in directly (without needing a company admin to create them first).</li>
                  <li>Useful for small companies where the Super Admin sets up everyone in one go.</li>
                </ol>

                <h6 className="fw-semibold mt-4">Step 4 — Company Admin Creates Employees</h6>
                <ol>
                  <li>The company admin logs in at <a href="/login" target="_blank"><code>/login</code></a> using the company TIN and their email/password.</li>
                  <li>Once logged in, the admin lands on the <strong>Company Admin Portal</strong> at <a href="/dashboard" target="_blank"><code>/dashboard</code></a> — this shows the full admin sidebar with HRMS, Stock, Sales, and other licensed modules.</li>
                  <li>Navigate to <strong>HRMS → Employees → Add Employee</strong> to register staff.</li>
                  <li>For each employee, the system creates an end-user account (role: Employee) linked to the company.</li>
                  <li>The employee can then log in at <a href="/login" target="_blank"><code>/login</code></a> using the company TIN and their employee email.</li>
                </ol>

                <h6 className="fw-semibold mt-4">Step 5 — End User Accesses Self Service</h6>
                <ol>
                  <li>Employee goes to <a href="/login" target="_blank"><code>/login</code></a>, enters the company TIN and their credentials.</li>
                  <li>After login, they land on the <strong>Employee Self Service Portal</strong> at <a href="/dashboard/self-service" target="_blank"><code>/dashboard/self-service</code></a>.</li>
                  <li>The sidebar shows only <strong>Self Service</strong> along with any modules the company has licensed.</li>
                  <li>The Self Service portal includes: attendance clock in/out, profile editing, leave requests, attendance history, and document viewing.</li>
                  <li>Employees cannot access Administration, settings, or other companies' data.</li>
                </ol>

                <h6 className="fw-semibold mt-4">Portal Access Summary</h6>
                <div className="table-responsive">
                  <table className="table table-bordered small">
                    <thead className="table-light">
                      <tr>
                        <th>Role</th>
                        <th>Portal</th>
                        <th>URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="badge bg-danger">Super Admin</span></td>
                        <td>Super Admin Dashboard</td>
                        <td><a href="/dashboard/admin" target="_blank"><code>/dashboard/admin</code></a></td>
                      </tr>
                      <tr>
                        <td><span className="badge bg-primary">Company Admin</span></td>
                        <td>Company Admin Portal</td>
                        <td><a href="/dashboard" target="_blank"><code>/dashboard</code></a></td>
                      </tr>
                      <tr>
                        <td><span className="badge bg-secondary">Employee</span></td>
                        <td>Employee Self Service</td>
                        <td><a href="/dashboard/self-service" target="_blank"><code>/dashboard/self-service</code></a></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h6 className="fw-semibold mt-4">Workflow Diagram</h6>
                <pre className="bg-light p-3 rounded small" style={{ fontFamily: "monospace" }}>
Super Admin → Register Company → Issue License → Create Company Admin
                                                      ↓
                                         Company Admin adds Employees
                                                      ↓
                                         Employees log in via Self Service
                                                      ↓
                                         Clock in/out · Leave · Profile
                </pre>

                <div className="alert alert-info small mt-3 mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  <strong>Tip:</strong> Use the <strong>Demo License</strong> workflow for quick trials — it auto-creates the company and issues a time-limited license in one step.
                </div>
              </Section>

              <Section id="dashboard" title="3. Dashboard">
                <p>The main dashboard provides a visual overview of your ERP system with interactive cards for each module.</p>
                <h6 className="fw-semibold">Key Features</h6>
                <ul>
                  <li><strong>Module Cards:</strong> Click any module card to navigate directly to that module</li>
                  <li><strong>Quick Actions:</strong> Add Employee, Record Attendance, and other shortcuts</li>
                  <li><strong>Stats Overview:</strong> Total employees, attendance today, pending leaves, active placements</li>
                  <li><strong>Recent Employees:</strong> Quick list of latest added employees</li>
                </ul>
                <Note>The sidebar on the left provides navigation to all modules. Use the search bar at the top to quickly find pages.</Note>
              </Section>

              <Section id="hrms" title="4. HRMS Module">
                <p>The Human Resource Management System handles all employee-related functions.</p>

                <h6 className="fw-semibold">Employees</h6>
                <ul>
                  <li>Add new employees with personal details, employment info, and documents</li>
                  <li>Manage employee records: edit, view full profile, terminate</li>
                  <li>Employee profile includes: banks, dependents, education, experience, documents, hobbies</li>
                </ul>

                <h6 className="fw-semibold">Departments</h6>
                <ul>
                  <li>Create and manage organizational departments</li>
                  <li>Assign employees to departments for reporting structure</li>
                </ul>

                <h6 className="fw-semibold">Positions</h6>
                <ul>
                  <li>Define job positions/titles within the organization</li>
                  <li>Link positions to departments</li>
                </ul>

                <h6 className="fw-semibold">Attendance</h6>
                <ul>
                  <li>Record daily attendance with clock-in/out times</li>
                  <li>Status options: Present, Late, Half-Day, Leave, Absent</li>
                  <li>View attendance history and reports</li>
                </ul>

                <h6 className="fw-semibold">Leave Management</h6>
                <ul>
                  <li>Define leave types (Annual, Sick, Maternity, etc.)</li>
                  <li>Employees can request leave via Self Service</li>
                  <li>Approve or reject leave requests</li>
                </ul>
              </Section>

              <Section id="stock" title="5. Stock / Inventory Module">
                <p>The Stock module manages inventory across multiple warehouses.</p>

                <h6 className="fw-semibold">Item Categories</h6>
                <ul>
                  <li>Group inventory items into categories for organization</li>
                  <li>Each category can have a description</li>
                </ul>

                <h6 className="fw-semibold">Items</h6>
                <ul>
                  <li>Create inventory items with name, SKU, unit, and category</li>
                  <li>Track current stock levels across warehouses</li>
                  <li>Set reorder levels for low-stock alerts</li>
                </ul>

                <h6 className="fw-semibold">Warehouses</h6>
                <ul>
                  <li>Manage multiple warehouse locations</li>
                  <li>Track stock balances per warehouse per item</li>
                </ul>

                <h6 className="fw-semibold">Stock Movements</h6>
                <ul>
                  <li>Record stock receipts, issues, and transfers between warehouses</li>
                  <li>Automatic stock balance updates</li>
                </ul>

                <h6 className="fw-semibold">Stock Adjustments</h6>
                <ul>
                  <li>Adjust stock levels for count discrepancies</li>
                  <li>Specify reason for adjustment</li>
                </ul>
              </Section>

              <Section id="sales" title="6. Sales Module">
                <p>The Sales module manages the complete sales cycle.</p>

                <h6 className="fw-semibold">Customers</h6>
                <ul>
                  <li>Maintain customer database with contact details</li>
                  <li>Track customer purchase history</li>
                </ul>

                <h6 className="fw-semibold">Quotations</h6>
                <ul>
                  <li>Create price quotations for customers</li>
                  <li>Convert quotations to sales orders</li>
                </ul>

                <h6 className="fw-semibold">Sales Orders</h6>
                <ul>
                  <li>Process customer orders</li>
                  <li>Track order status and fulfillment</li>
                </ul>

                <h6 className="fw-semibold">Invoices</h6>
                <ul>
                  <li>Generate invoices from sales orders</li>
                  <li>Track payment status</li>
                </ul>

                <h6 className="fw-semibold">Point of Sale (POS)</h6>
                <ul>
                  <li>Quick checkout interface for retail transactions</li>
                  <li>Real-time inventory deduction</li>
                </ul>
              </Section>

              <Section id="finance" title="7. Finance Module">
                <p>The Finance module provides comprehensive financial management.</p>
                <ul>
                  <li><strong>Chart of Accounts:</strong> Define your accounting structure</li>
                  <li><strong>Journal:</strong> Record financial transactions with double-entry bookkeeping</li>
                  <li><strong>Ledger:</strong> View account balances and transaction history</li>
                  <li><strong>Payments:</strong> Manage accounts payable and receivable</li>
                  <li><strong>Budget:</strong> Set and track departmental budgets</li>
                </ul>
              </Section>

              <Section id="procurement" title="8. Procurement Module">
                <p>Manage the purchasing and supply chain process.</p>
                <ul>
                  <li><strong>Suppliers:</strong> Maintain vendor database with contact and payment terms</li>
                  <li><strong>Purchase Orders:</strong> Create and track purchase orders to suppliers</li>
                  <li><strong>RFQ:</strong> Request for Quotations from multiple suppliers</li>
                  <li><strong>Returns:</strong> Handle purchase returns and credit notes</li>
                </ul>
              </Section>

              <Section id="production" title="9. Production Module">
                <p>Manage manufacturing and production processes.</p>
                <ul>
                  <li><strong>Bill of Materials (BOM):</strong> Define product structure with raw materials and quantities</li>
                  <li><strong>Work Orders:</strong> Schedule and track production runs</li>
                  <li><strong>Routings:</strong> Define production steps and work centers</li>
                </ul>
              </Section>

              <Section id="ecommerce" title="10. E-Commerce Module">
                <p>Manage online sales channels.</p>
                <ul>
                  <li><strong>Products:</strong> Manage online product catalog with descriptions and prices</li>
                  <li><strong>Online Orders:</strong> Process orders received through online channels</li>
                  <li><strong>Customers:</strong> Manage online customer accounts</li>
                </ul>
              </Section>

              <Section id="payroll" title="11. Payroll">
                <p>The Payroll module handles employee compensation with Ethiopian compliance.</p>
                <ul>
                  <li><strong>Payroll Periods:</strong> Define monthly payroll periods</li>
                  <li><strong>Process Payroll:</strong> Calculate salaries with Ethiopian PAYE tax and pension contributions</li>
                  <li><strong>Payroll Items:</strong> View individual employee payslips</li>
                  <li><strong>PAYE Brackets:</strong> Configurable Ethiopian income tax brackets</li>
                  <li><strong>Pension Settings:</strong> Configure employer and employee pension contribution rates</li>
                </ul>
                <Note>Payroll calculations follow Ethiopian tax laws including PAYE (income tax) and pension contributions (7% employee + 11% employer).</Note>
              </Section>

              <Section id="selfservice" title="12. Employee Self Service">
                <p>The Self Service portal allows regular employees to manage their own information.</p>

                <h6 className="fw-semibold">Access</h6>
                <p>Navigate to <strong>HRMS → Self Service</strong> in the sidebar, or visit <code>/dashboard/self-service</code>.</p>

                <h6 className="fw-semibold">Features</h6>
                <ul>
                  <li><strong>Dashboard:</strong> Welcome greeting, today's attendance status, pending leaves count, quick access cards</li>
                  <li><strong>Clock In / Clock Out:</strong> Record daily attendance with one click</li>
                  <li><strong>My Profile:</strong> View personal details, edit phone number and address</li>
                  <li><strong>Attendance History:</strong> View all your attendance records with status</li>
                  <li><strong>Leave Requests:</strong> Check leave balance, submit new leave requests, track approval status</li>
                  <li><strong>My Documents:</strong> View uploaded documents</li>
                </ul>
              </Section>

              <Section id="admin" title="13. Administration">
                <p>The Administration section is for system administrators and company admins only.</p>

                <h6 className="fw-semibold">Super Admin Dashboard</h6>
                <ul>
                  <li>System-wide overview: total companies, active licenses, users</li>
                  <li>Expiring license alerts</li>
                  <li>Module adoption statistics</li>
                </ul>

                <h6 className="fw-semibold">Companies</h6>
                <ul>
                  <li>Register new companies with TIN (Tax Identification Number)</li>
                  <li>Assign module licenses per company</li>
                  <li>View user count per company</li>
                </ul>

                <h6 className="fw-semibold">Demo Licenses</h6>
                <ul>
                  <li>Issue demo/trial licenses to companies</li>
                  <li>Select which modules to enable</li>
                  <li>Auto-create company if not registered</li>
                  <li>Track license status (Active, Expiring, Expired)</li>
                </ul>

                <h6 className="fw-semibold">Users</h6>
                <ul>
                  <li>Create and manage system users</li>
                  <li>Assign roles (Admin, Employee)</li>
                  <li>Link users to companies</li>
                </ul>
              </Section>

              <Section id="access-control" title="14. Spa & Gym Access">
                <p className="lead">Focused entry and access operations for Spa and Gym facilities.</p>
                <Note>The parking dashboard, slots, vehicles, rates and embedded POS were removed. No parking tables, ANPR, vehicle recognition or payment logic is used.</Note>

                <h6 className="fw-semibold mt-4">Canonical Masters</h6>
                <ul>
                  <li><strong>Customer &amp; Member Master:</strong> one customer record with a classification; duplicate email, phone and ID registration is blocked.</li>
                  <li><strong>Offering Master:</strong> one classified record for membership plans, Spa services, Gym services, packages and access passes.</li>
                  <li><strong>Areas &amp; Facilities:</strong> one master for rooms, zones, studios, pools and shared areas.</li>
                </ul>

                <h6 className="fw-semibold mt-4">Access Pages</h6>
                <div className="table-responsive">
                  <table className="table table-bordered table-sm small">
                    <thead><tr><th>Page</th><th>Route</th><th>Purpose</th></tr></thead>
                    <tbody>
                      <tr><td>Entry Gates</td><td><code>/dashboard/spa/access/gates</code></td><td>QR, RFID, NFC and optional controller configuration.</td></tr>
                      <tr><td>Security Cameras</td><td><code>/dashboard/spa/access/cameras</code></td><td>Security, occupancy, safety and check-in cameras; network or browser webcam.</td></tr>
                      <tr><td>Member Cards</td><td><code>/dashboard/spa/access/rfid-cards</code></td><td>Member cards and wristbands.</td></tr>
                      <tr><td>Access Control</td><td><code>/dashboard/spa/access/control</code></td><td>Access events and the optional local-relay command queue.</td></tr>
                      <tr><td>QR Access</td><td><code>/dashboard/spa/access/qr-access</code></td><td>Webcam/manual QR verification and access logging.</td></tr>
                      <tr><td>Guest QR Passes</td><td><code>/dashboard/spa/access/qr-tickets</code></td><td>Guest, member and day access passes.</td></tr>
                      <tr><td>Check-In Kiosk</td><td><code>/dashboard/spa/access/kiosk</code></td><td>Creates a visit and printable 24-hour QR pass for an existing customer or walk-in.</td></tr>
                    </tbody>
                  </table>
                </div>

                <h6 className="fw-semibold mt-4">Local Relay Safety</h6>
                <p>Queueing an <strong>Open Door</strong> command does not claim that a physical gate opened. The command remains pending until a separately installed local relay acknowledges it. Controller metadata is optional.</p>

                <h6 className="fw-semibold mt-4">Required Migrations</h6>
                <pre className="bg-light p-3 rounded small">psql "$DATABASE_URL" -f db-migration-v35.sql{`
`}psql "$DATABASE_URL" -f db-migration-v36.sql</pre>
              </Section>

              <Section id="faq" title="15. Frequently Asked Questions">
                <div className="accordion" id="faqAccordion">
                  {[
                    {
                      q: "How do I reset my password?",
                      a: "Contact your system administrator to reset your password. Password reset functionality is managed at the admin level."
                    },
                    {
                      q: "Why can't I see certain modules?",
                      a: "Modules are licensed per company. If you cannot see a module, your company may not have an active license for it. Contact your company admin."
                    },
                    {
                      q: "How do I switch between English and Amharic?",
                      a: "Click the language icon in the top bar (🌐 or language code) and select your preferred language from the dropdown."
                    },
                    {
                      q: "How does multi-company access work?",
                      a: "Each user belongs to one company. You log in using your Company TIN. Super Admins can see all companies. Regular users only see their own company's data."
                    },
                    {
                      q: "How do I record attendance for employees?",
                      a: "Go to HRMS → Attendance. You can record attendance manually. Employees can also clock in/out through the Self Service portal."
                    },
                    {
                      q: "What payroll taxes are supported?",
                      a: "The system supports Ethiopian PAYE (income tax) with configurable brackets, and pension contributions (employee 7%, employer 11%)."
                    },
                    {
                      q: "Can I customize the system?",
                      a: "The system supports module licensing (you enable only the modules you need). System settings and configurations are managed through the Settings page."
                    },
                    {
                      q: "How do I get support?",
                      a: "Contact your system administrator for support. For technical issues, reach out to the Genius ERP support team."
                    }
                  ].map((faq, i) => (
                    <div className="accordion-item" key={i}>
                      <h2 className="accordion-header">
                        <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target={`#faq${i}`}>
                          {faq.q}
                        </button>
                      </h2>
                      <div id={`faq${i}`} className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                        <div className="accordion-body small">{faq.a}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section id="developer" title="Developer Guide">
                <p className="lead">Technical reference for developers customizing the Genius ERP platform.</p>

                <h6 className="fw-semibold mt-4">Module System Architecture</h6>
                <p>Each module has a unique <code>code</code> stored in the <code>modules</code> database table. Companies are linked to modules via <code>company_modules</code> (with <code>is_enabled</code> flag). The sidebar and dashboard module grid filter by license using the <code>moduleCode</code> property.</p>

                <h6 className="fw-semibold mt-4">Registering a New Module</h6>
                <ol>
                  <li><strong>Database:</strong> Insert a row into the <code>modules</code> table:
                    <pre className="bg-dark text-light p-3 rounded small mt-2 mb-2 overflow-auto">{`INSERT INTO modules (code, name, description, icon, sort_order)
 VALUES ('my_module', 'My Module', 'Description', 'bi-plugin', 10);`}
                    </pre>
                  </li>
                  <li><strong>Sidebar group</strong> in <code>app/dashboard/layout.tsx</code> — add an entry to <code>sidebarGroups</code> with <code>moduleCode: "my_module"</code>:
                    <pre className="bg-dark text-light p-3 rounded small mt-2 mb-2 overflow-auto">{`{
  name: "My Module",
  moduleCode: "my_module",
  icon: "bi-plugin",
  adminOnly: false,
  links: [
    { name: "Dashboard", href: "/dashboard/my-module", icon: "bi-speedometer2", adminOnly: false },
  ]
}`}
                    </pre>
                  </li>
                  <li><strong>Dashboard grid card</strong> in <code>app/dashboard/page.tsx</code> — add an entry to the <code>modules</code> array with <code>moduleCode: "my_module"</code>.</li>
                  <li><strong>Issue a license</strong> — create a demo license or assign the module via the Companies page to enable it for a company. The sidebar and dashboard will auto-hide the module until licensed.</li>
                </ol>

                <h6 className="fw-semibold mt-4">How Module Gating Works</h6>
                <ul>
                  <li><strong>sidebarGroups</strong> in <code>layout.tsx</code> — groups with a <code>moduleCode</code> are hidden unless the user's company has that module enabled in <code>company_modules</code>.</li>
                  <li><strong>Dashboard grid</strong> in <code>page.tsx</code> — cards with a <code>moduleCode</code> are filtered the same way.</li>
                  <li><strong>Always-visible groups</strong> — Dashboard, Audit, System, and Administration have no <code>moduleCode</code> and are always shown (subject to role checks).</li>
                  <li><strong>Data source</strong> — licensed modules are fetched via <code>GET /api/companies/{'{companyId}'}</code>, which returns a <code>modules</code> array with <code>{'{ id, code, name, enabled }'}</code>.</li>
                </ul>

                <h6 className="fw-semibold mt-4">Adding a New Page</h6>
                <ol>
                  <li>Create the page file under <code>app/dashboard/my-module/</code> (e.g. <code>page.tsx</code>, <code>[id]/page.tsx</code>).</li>
                  <li>Add the sidebar link (see above).</li>
                  <li>Add translation keys in <code>messages/en.json</code> and <code>messages/am.json</code> — use the pattern <code>nav.{'{group}'}.{'{link}'}</code> (e.g. <code>"nav.my_module.dashboard"</code>).</li>
                  <li>Use <code>{'const { t } = useLanguage()'}</code> and call <code>t("nav.my_module.dashboard")</code> to display the translated label.</li>
                  <li>Run <code>npx next build</code> to verify zero TypeScript errors.</li>
                </ol>

                <h6 className="fw-semibold mt-4">Translation System</h6>
                <p>Translation files are nested JSON objects in <code>messages/en.json</code> and <code>messages/am.json</code>. Keys follow a dot-separated convention that maps to nested objects:</p>
                <pre className="bg-dark text-light p-3 rounded small mt-2 mb-2 overflow-auto">{`{
  "nav": {
    "sales": {
      "dashboard": "Sales",
      "customers": "Customers"
    }
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel"
  }
}`}
                </pre>
                <p>The <code>t("nav.sales.dashboard")</code> function traverses the nested object to find the translation. If not found, it returns the key itself.</p>

                <h6 className="fw-semibold mt-4">API Route Pattern</h6>
                <pre className="bg-dark text-light p-3 rounded small mt-2 mb-2 overflow-auto">{`import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  // user has: id, email, role, company_id, company_name, company_tin
  try {
    const result = await pool.query("SELECT * FROM my_table WHERE company_id = $1", [user.company_id]);
    return NextResponse.json(result.rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}`}
                </pre>

                <h6 className="fw-semibold mt-4">Build &amp; Deploy</h6>
                <ul>
                  <li><strong>Build:</strong> <code>npx next build</code> — runs TypeScript check + Turbopack compilation. Must pass with 0 errors.</li>
                  <li><strong>Dev:</strong> <code>npx next dev</code> — hot-reload development server.</li>
                  <li><strong>Database:</strong> Uses <code>pg.Pool</code> with <code>DATABASE_URL</code> env var. Set in <code>.env</code> locally and in Vercel environment variables.</li>
                  <li><strong>Database migrations:</strong> SQL files named <code>db-migration-v{'{number}'}.sql</code>. Apply in order. Use <code>IF NOT EXISTS</code> / <code>IF EXISTS</code> for idempotent re-runs.</li>
                </ul>
              </Section>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
