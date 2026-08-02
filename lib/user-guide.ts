export type GuidePage = {
  title: string;
  route?: string;
  permission: string;
  audience?: string;
  summary: string;
  actions?: string[];
  fields?: string[];
  moduleKey?: string;
  note?: string;
};

export type GuideSection = {
  id: string;
  number: number;
  title: string;
  icon: string;
  intro?: string;
  pages: GuidePage[];
};

export const USER_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "login-entry",
    number: 1,
    title: "Login & Entry",
    icon: "box-arrow-in-right",
    pages: [
      {
        title: "Login",
        route: "/login",
        permission: "Public",
        audience: "All users before authentication",
        summary: "Email and password sign-in with English and Amharic language switching. Successful sign-in stores the token and user locally, then opens the correct dashboard.",
        actions: ["Sign in", "Switch language", "Request account help"],
        fields: ["Email *", "Password *"],
        note: "Login API variants support admin, super administrator, employee, guest and company entry. Super administrators continue to /dashboard/admin.",
      },
    ],
  },
  {
    id: "dashboard",
    number: 2,
    title: "Dashboard",
    icon: "house-door",
    pages: [
      {
        title: "Company Dashboard",
        route: "/dashboard",
        permission: "dashboard",
        summary: "The daily starting point with a time-based greeting, company identity, module cards, operational shortcuts and current spa activity.",
        actions: ["New Visit", "New Booking", "Register Member", "Open Service Orders"],
        fields: ["Total Members", "Today's Visits", "In Treatment", "Draft Orders", "Recent Members"],
      },
      {
        title: "Spa Management Hub",
        route: "/dashboard/membership",
        permission: "membership_members",
        summary: "A visual launchpad for Customers, Membership, Operations, Gym, Spa, Inventory, Service Orders, Staff, Facilities and Reports.",
        actions: ["Open visits", "Open schedule", "Open gym", "Open members"],
      },
    ],
  },
  {
    id: "customers",
    number: 3,
    title: "Customers",
    icon: "people",
    pages: [
      {
        title: "Customer & Member Master",
        route: "/dashboard/spa/customers/profiles",
        permission: "membership_members",
        summary: "One customer record classified as customer, member, VIP, corporate or guest. Membership offerings are assigned to this same record.",
        actions: ["Add customer once", "Search", "Filter classification", "Assign offering", "Open profile"],
        fields: ["Customer Code", "Full Name *", "Classification *", "Phone", "Email", "ID Number", "Address", "Membership / Package Offering", "Start Date", "Notes"],
        note: "Duplicate email, phone or ID registration is blocked and links the user to the existing customer record.",
      },
      {
        title: "Medical Records",
        route: "/dashboard/spa/customers/medical-records",
        permission: "spa_medical_records",
        summary: "Permission-controlled clinical and wellness notes for consultations, conditions, allergies, medication, injuries and follow-up.",
        moduleKey: "customers/medical-records",
      },
      {
        title: "Visit History",
        route: "/dashboard/spa/customers/visit-history",
        permission: "membership_sessions",
        summary: "Customer sessions and visits with facility, check-in, check-out, duration and source.",
        actions: ["Filter by date", "Review duration", "Open customer"],
      },
      {
        title: "Loyalty",
        route: "/dashboard/spa/customers/loyalty",
        permission: "spa_loyalty",
        summary: "Operational loyalty tiers and point balances for repeat customers.",
        moduleKey: "customers/loyalty",
      },
    ],
  },
  {
    id: "membership",
    number: 4,
    title: "Offerings & Membership",
    icon: "collection",
    pages: [
      {
        title: "Offering Master",
        route: "/dashboard/spa/catalog/offerings",
        permission: "catalog_offerings",
        summary: "One classified master for membership plans, Spa services, Gym services, packages and access passes. Separate plan/service/package masters are retired.",
        moduleKey: "catalog/offerings",
        note: "Pricing is intentionally excluded and remains in the separate Sales/POS application.",
      },
      {
        title: "Memberships & Renewals",
        route: "/dashboard/spa/membership/renewals",
        permission: "membership_subscriptions",
        summary: "Assign a membership, package or access-pass offering to the existing customer record and manage its validity period.",
        actions: ["Select existing customer", "Assign offering", "Extend end date", "Cancel membership"],
        fields: ["Customer *", "Offering *", "Start Date", "End Date *", "Billing Cycle", "Auto Renew"],
      },
      {
        title: "Freeze / Transfer",
        route: "/dashboard/spa/membership/freeze-transfer",
        permission: "membership_freeze_transfer",
        summary: "Track membership freeze and transfer requests against the existing customer and offering assignment.",
        moduleKey: "membership/freeze-transfer",
      },
      {
        title: "Legacy Compatibility",
        permission: "Read-only compatibility",
        audience: "Administrators migrating older records",
        summary: "Legacy membership plan routes now open or return the canonical Offering Master. Legacy write APIs return HTTP 410 to prevent duplicate master data.",
      },
    ],
  },
  {
    id: "operations",
    number: 5,
    title: "Operations",
    icon: "activity",
    pages: [
      {
        title: "Visits — Reception",
        route: "/dashboard/spa/operations/visits",
        permission: "spa_visits",
        summary: "Reception checks in an existing member or walk-in guest and follows each visit from arrival through cashier handoff.",
        actions: ["Create visit", "Search", "Filter status/date", "Open therapist workspace"],
        fields: ["Member or Guest", "Customer Name *", "Phone", "Reception Notes"],
        note: "Status flow: checked in → assigned → in treatment → finished → order printed → handed to cashier, or cancelled.",
      },
      {
        title: "Visit Treatment Workspace",
        route: "/dashboard/spa/operations/visits/[id]",
        permission: "spa_visits + spa_visit_services + spa_service_orders",
        summary: "The therapist-facing screen for assignment, treatment start, services used, notes, finishing and the 80 mm cashier-handoff draft.",
        actions: ["Assign therapist", "Start treatment", "Add/remove service", "Save notes", "Finish treatment", "Print draft", "Mark handed to cashier"],
        fields: ["Visit Number", "Customer", "Therapist", "Services and Quantities", "Treatment Notes"],
      },
      {
        title: "Appointments / Bookings",
        route: "/dashboard/spa/operations/appointments",
        permission: "membership_appointments",
        summary: "Facility-aware booking calendar. Checking in a confirmed appointment creates or opens its operational visit.",
        actions: ["New booking", "Navigate dates", "Check in", "Complete", "Cancel"],
        fields: ["Member or Guest *", "Facility / Room *", "Service", "Start Time *", "Duration", "Notes"],
      },
      {
        title: "Sessions",
        route: "/dashboard/spa/operations/sessions",
        permission: "membership_sessions",
        summary: "Active and completed access sessions with check-in, check-out, facility and duration.",
        actions: ["Create session", "Check out", "Filter active/date"],
      },
      {
        title: "Queue",
        route: "/dashboard/spa/operations/queue",
        permission: "spa_queue",
        summary: "Coordinate waiting customers, priority, estimated wait and service assignment.",
        moduleKey: "operations/queue",
      },
      {
        title: "Customer Requests",
        route: "/dashboard/spa/operations/customer-requests",
        permission: "spa_customer_requests",
        summary: "Track booking, reschedule, facility, service-order, complaint and assistance requests through resolution.",
        moduleKey: "operations/customer-requests",
      },
      {
        title: "Towel Management",
        route: "/dashboard/spa/operations/towel-management",
        permission: "spa_towels",
        summary: "Issue towels against a visit and record returns, partial returns, losses and laundry status.",
        moduleKey: "operations/towel-management",
      },
      {
        title: "Service Orders",
        route: "/dashboard/spa/operations/service-orders",
        permission: "spa_service_orders",
        summary: "Price-free draft orders generated when treatment finishes. Used only as the physical handoff to the separate POS cashier.",
        actions: ["Open visit", "Print/reprint 80 mm draft", "Mark handed to cashier", "Search/filter"],
        fields: ["Visit Number", "Customer", "Therapist", "Services", "Quantities", "Total Items", "Draft Status", "Print Count"],
        note: "A Service Order is never an invoice or receipt. It contains no prices, discounts, tax or payment data.",
      },
    ],
  },
  {
    id: "access-suite",
    number: 6,
    title: "Access",
    icon: "shield-check",
    intro: "A focused Spa/Gym entry suite. Parking dashboard, slots, vehicles, rates, POS and duplicate customer/subscription/session/report links have been removed.",
    pages: [
      { title: "Entry Gates", route: "/dashboard/spa/access/gates", permission: "membership_gates", summary: "Entry-point configuration with QR, RFID, NFC and optional controller networking.", actions: ["Add/edit gate", "Set reader features", "Change status", "Review camera/command counts"] },
      { title: "Security Cameras", route: "/dashboard/spa/access/cameras", permission: "access_cameras", summary: "Security, occupancy, safety and check-in cameras with network streams or browser webcam detection.", actions: ["Detect webcam", "Preview", "Register network camera", "Assign gate/area", "Change status"] },
      { title: "Member Cards", route: "/dashboard/spa/access/rfid-cards", permission: "membership_rfid_cards", summary: "Member cards and wristbands for Spa/Gym entry." },
      { title: "Access Control", route: "/dashboard/spa/access/control", permission: "access_control", summary: "Live access logs and optional local-relay command queue. Commands remain pending until acknowledged by local hardware.", actions: ["Select gate", "Queue open command", "Review events", "Review relay queue"] },
      { title: "QR Access", route: "/dashboard/spa/access/qr-access", permission: "access_control", summary: "Webcam and manual QR verification with access logging and optional door-command queueing.", actions: ["Start/stop scanner", "Verify token", "Select gate", "Review scan history"] },
      { title: "Guest QR Passes", route: "/dashboard/spa/access/qr-tickets", permission: "membership_qr_passes", summary: "Guest, member and day QR access passes." },
      { title: "Check-In Kiosk", route: "/dashboard/spa/access/kiosk", permission: "access_kiosk", summary: "Member/walk-in check-in that creates one customer visit and a printable 24-hour QR pass.", actions: ["Select existing customer or walk-in", "Choose area/gate", "Check in", "Print QR pass", "Open visit"] },
    ],
  },
  {
    id: "gym",
    number: 7,
    title: "Gym",
    icon: "heart-pulse",
    pages: [
      { title: "Trainers", route: "/dashboard/spa/gym/trainers", permission: "gym_trainers", summary: "Trainer profiles, specialties and certifications.", moduleKey: "gym/trainers" },
      { title: "Workout Plans", route: "/dashboard/spa/gym/workout-plans", permission: "gym_workout_plans", summary: "Member workout programs and goals.", moduleKey: "gym/workout-plans" },
      { title: "Fitness Assessment", route: "/dashboard/spa/gym/fitness-assessments", permission: "gym_fitness_assessments", summary: "Baseline and follow-up fitness evaluations.", moduleKey: "gym/fitness-assessments" },
      { title: "Body Measurements", route: "/dashboard/spa/gym/body-measurements", permission: "gym_body_measurements", summary: "Body composition and circumference tracking with automatic BMI.", moduleKey: "gym/body-measurements" },
      { title: "Classes", route: "/dashboard/spa/gym/classes", permission: "gym_classes", summary: "Class schedules, trainers, capacity and enrollment.", moduleKey: "gym/classes" },
      { title: "Attendance", route: "/dashboard/spa/gym/attendance", permission: "membership_attendance", summary: "Live gym floor and check-in/check-out history.", actions: ["Check in", "Check out", "Review occupancy"] },
    ],
  },
  {
    id: "spa",
    number: 8,
    title: "Spa",
    icon: "flower1",
    pages: [
      { title: "Therapists", route: "/dashboard/spa/spa/therapists", permission: "spa_therapists", summary: "Therapist profiles, specialties and certifications.", moduleKey: "spa/therapists" },
      { title: "Treatment Rooms", route: "/dashboard/spa/spa/treatment-rooms", permission: "membership_facilities", summary: "A filtered view of the single Areas & Facilities master.", actions: ["Add room", "Edit", "Activate/deactivate", "Delete"] },
      { title: "Bookings", route: "/dashboard/spa/spa/bookings", permission: "membership_appointments", summary: "Alias of the appointment calendar using classified service/package offerings.", actions: ["Book treatment", "Check in", "Complete", "Cancel"] },
    ],
  },
  {
    id: "inventory",
    number: 9,
    title: "Inventory",
    icon: "boxes",
    pages: [
      { title: "Products", route: "/dashboard/spa/inventory/products", permission: "inventory_products", summary: "Operational product quantity and replenishment thresholds without sales pricing.", moduleKey: "inventory/products" },
      { title: "Consumables", route: "/dashboard/spa/inventory/consumables", permission: "inventory_consumables", summary: "Treatment consumables, expiry, storage and stock levels.", moduleKey: "inventory/consumables" },
      { title: "Stock Usage", route: "/dashboard/spa/inventory/stock-usage", permission: "inventory_stock_usage", summary: "Record inventory consumed by a service, visit, facility or staff member.", moduleKey: "inventory/stock-usage" },
      { title: "Suppliers", route: "/dashboard/spa/inventory/suppliers", permission: "inventory_suppliers", summary: "Supplier contacts, supplied items and operational terms.", moduleKey: "inventory/suppliers" },
    ],
  },
  {
    id: "staff",
    number: 10,
    title: "Staff",
    icon: "person-workspace",
    pages: [
      { title: "Employees", route: "/dashboard/spa/staff/employees", permission: "staff_employees", summary: "Spa and gym employee profiles and assignments.", moduleKey: "staff/employees" },
      { title: "Schedules", route: "/dashboard/spa/staff/schedules", permission: "staff_schedules", summary: "Employee shifts, work locations and responsibilities.", moduleKey: "staff/schedules" },
      { title: "Commission", route: "/dashboard/spa/staff/commission", permission: "staff_commission", summary: "Commission worksheet with automatic base × rate calculation.", moduleKey: "staff/commission" },
      { title: "Performance", route: "/dashboard/spa/staff/performance", permission: "staff_performance", summary: "Employee review scores, strengths and development goals.", moduleKey: "staff/performance" },
    ],
  },
  {
    id: "facilities",
    number: 11,
    title: "Facilities",
    icon: "building",
    pages: [
      { title: "Areas & Facilities", route: "/dashboard/spa/access/zones", permission: "access_zones", summary: "The single master for rooms, zones, studios, pools and shared Spa/Gym areas.", actions: ["Add area", "Set type/capacity", "Edit", "Delete"] },
      { title: "Lockers", route: "/dashboard/spa/facilities/lockers", permission: "facilities_lockers", summary: "Locker availability, assignment and maintenance.", moduleKey: "facilities/lockers" },
      { title: "Equipment", route: "/dashboard/spa/facilities/equipment", permission: "facilities_equipment", summary: "Gym, spa and building equipment register.", moduleKey: "facilities/equipment" },
      { title: "Maintenance", route: "/dashboard/spa/facilities/maintenance", permission: "facilities_maintenance", summary: "Issue reporting, priority, assignment, schedule and resolution.", moduleKey: "facilities/maintenance" },
    ],
  },
  {
    id: "reports",
    number: 12,
    title: "Reports",
    icon: "bar-chart",
    intro: "Every report uses a from/to date range, summary cards, a detailed table, print and CSV export.",
    pages: [
      { title: "Access Report", route: "/dashboard/spa/reports/access", permission: "reports_access", summary: "Gate events, granted/denied access, methods and entry/exit trends.", actions: ["Set date range", "Print", "Export CSV"] },
      { title: "Membership Report", route: "/dashboard/spa/reports/membership", permission: "reports_membership", summary: "Total, active, expired and newly registered members plus plan performance.", actions: ["Set date range", "Refresh", "Print", "Export CSV"] },
      { title: "Attendance Report", route: "/dashboard/spa/reports/attendance", permission: "reports_attendance", summary: "Check-in volume, unique members, active visits and duration trends.", actions: ["Set date range", "Print", "Export CSV"] },
      { title: "Service Order Report", route: "/dashboard/spa/reports/service-orders", permission: "reports_service_orders", summary: "Draft, printed and cashier-handoff volume with item counts and no financial data.", actions: ["Set date range", "Print", "Export CSV"] },
      { title: "Therapist Report", route: "/dashboard/spa/reports/therapist", permission: "reports_therapist", summary: "Assigned visits, completed treatments, service items and average treatment duration.", actions: ["Set date range", "Print", "Export CSV"] },
      { title: "Trainer Report", route: "/dashboard/spa/reports/trainer", permission: "reports_trainer", summary: "Trainer classes, workout plans, assessments and member activity.", actions: ["Set date range", "Print", "Export CSV"] },
      { title: "Inventory Report", route: "/dashboard/spa/reports/inventory", permission: "reports_inventory", summary: "Stock items, units on hand, low/out-of-stock attention and usage entries.", actions: ["Set date range", "Print", "Export CSV"] },
    ],
  },
  {
    id: "settings-administration",
    number: 13,
    title: "Settings & Administration",
    icon: "gear",
    pages: [
      { title: "Users", route: "/dashboard/users", permission: "users", audience: "Company administrators", summary: "Create and manage system users, role assignment, contact details and active status.", actions: ["Add user", "Edit user", "Activate/deactivate"], fields: ["Full Name *", "Email *", "Role *", "Phone", "Active"] },
      { title: "Roles & Permissions", route: "/dashboard/roles", permission: "roles", audience: "Company administrators", summary: "Permission matrix grouped by Dashboard, Customers, Offering Catalog, Membership, Operations, Access, Gym, Spa, Inventory, Staff, Facilities, Reports and System.", actions: ["Create role", "Toggle view/create/edit/delete/approve", "Save permissions"] },
      { title: "System Settings", route: "/dashboard/system-settings", permission: "settings", audience: "Company administrators", summary: "Company identity and operational configuration.", fields: ["Company Name", "Address", "Phone", "Email", "Currency (legacy display setting)"] },
      { title: "Audit Logs", route: "/dashboard/audit-logs", permission: "audit_logs", summary: "User, action, table, record, old/new values, client information and timestamp for audited changes.", actions: ["Review events", "Filter activity"] },
      { title: "ID Definitions", route: "/dashboard/settings/id-definitions", permission: "id_definitions", audience: "Company administrators", summary: "Numbering rules per entity.", fields: ["Prefix", "Separator", "Padding", "Starting Value", "Reset Type", "Pattern"] },
      { title: "Branches", route: "/dashboard/spa/settings/branches", permission: "settings_branches", audience: "Company administrators", summary: "Operating branch identity, contact details and management.", moduleKey: "settings/branches" },
      { title: "Platform Administration", route: "/dashboard/admin", permission: "companies", audience: "Super administrators only", summary: "Company management, demo licenses, platform audit and licensed manual documents.", actions: ["Manage companies", "Issue licenses", "Review platform audit", "Open manuals"], note: "Related routes: /dashboard/companies, /dashboard/demo-licenses, /dashboard/admin/manuals and /dashboard/admin/issued-manuals." },
    ],
  },
  {
    id: "notifications",
    number: 14,
    title: "Notifications",
    icon: "bell",
    pages: [
      { title: "Notifications", route: "/dashboard/notifications", permission: "notifications", summary: "Operational alerts with title, message, type and read/unread state. The header bell provides quick access.", actions: ["Open notification", "Mark read/unread", "Delete"] },
    ],
  },
  {
    id: "shared-ui",
    number: 15,
    title: "Shared UI Components",
    icon: "grid",
    intro: "Reusable interface patterns keep list pages, forms, statuses and reports consistent.",
    pages: [
      { title: "Tables & Search", permission: "Component reference", summary: "DataTable provides sortable/searchable lists; SearchInput provides debounced page search.", actions: ["Sort", "Search", "Paginate"] },
      { title: "Status & Statistics", permission: "Component reference", summary: "StatCard and StatusBadge provide consistent KPIs and colour-coded operational state." },
      { title: "Forms & Confirmation", permission: "Component reference", summary: "FormField, ConfirmDialog and shared modal patterns provide validation and safe destructive actions." },
      { title: "Page Structure", permission: "Component reference", summary: "PageHeader, EmptyState and ReportFilters provide consistent headings, no-data guidance and date-range reporting." },
    ],
  },
];

export const GUIDE_COMPONENTS = [
  ["DataTable", "Sortable, searchable table for list pages"],
  ["SearchInput", "Debounced header and list search"],
  ["StatCard", "Dashboard and report KPI card"],
  ["StatusBadge", "Colour-coded operational status"],
  ["FormField", "Labelled input with validation"],
  ["ConfirmDialog", "Destructive-action confirmation"],
  ["EmptyState", "Friendly no-data placeholder"],
  ["PageHeader", "Page title and contextual actions"],
  ["ReportFilters", "Shared date-range report controls"],
] as const;
