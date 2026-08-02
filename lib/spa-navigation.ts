export type SidebarLink = {
  name: string;
  href: string;
  icon: string;
  resource: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  target?: "_blank";
};

export type SidebarGroup = {
  name: string;
  icon: string;
  links: SidebarLink[];
  moduleCode?: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  direct?: boolean;
};

export const sidebarGroups: SidebarGroup[] = [
  {
    name: "Dashboard",
    icon: "bi-house-door",
    direct: true,
    links: [
      { name: "Dashboard", href: "/dashboard", icon: "bi-house-door", resource: "dashboard" },
    ],
  },
  {
    name: "User Guide",
    icon: "bi-journal-bookmark",
    direct: true,
    links: [
      { name: "User Guide", href: "/dashboard/guide", icon: "bi-journal-bookmark", resource: "dashboard" },
    ],
  },
  {
    name: "Customers",
    icon: "bi-people",
    moduleCode: "membership",
    links: [
      { name: "Customer Profiles", href: "/dashboard/spa/customers/profiles", icon: "bi-person-vcard", resource: "membership_members" },
      { name: "Medical Records", href: "/dashboard/spa/customers/medical-records", icon: "bi-clipboard2-pulse", resource: "spa_medical_records" },
      { name: "Visit History", href: "/dashboard/spa/customers/visit-history", icon: "bi-clock-history", resource: "membership_sessions" },
      { name: "Loyalty", href: "/dashboard/spa/customers/loyalty", icon: "bi-stars", resource: "spa_loyalty" },
    ],
  },
  {
    name: "Membership",
    icon: "bi-person-badge",
    moduleCode: "membership",
    links: [
      { name: "Membership Plans", href: "/dashboard/membership/plans", icon: "bi-layers", resource: "membership_plans" },
      { name: "Member Registration", href: "/dashboard/spa/membership/member-registration", icon: "bi-person-plus", resource: "membership_members" },
      { name: "Renewals", href: "/dashboard/spa/membership/renewals", icon: "bi-arrow-repeat", resource: "membership_subscriptions" },
      { name: "Freeze / Transfer", href: "/dashboard/spa/membership/freeze-transfer", icon: "bi-arrow-left-right", resource: "membership_freeze_transfer" },
      { name: "Digital Cards", href: "/dashboard/spa/membership/digital-cards", icon: "bi-credit-card-2-front", resource: "membership_rfid_cards" },
      { name: "QR Access", href: "/dashboard/spa/membership/qr-access", icon: "bi-qr-code", resource: "membership_qr_passes" },
    ],
  },
  {
    name: "Operations",
    icon: "bi-activity",
    moduleCode: "membership",
    links: [
      { name: "Visits", href: "/dashboard/spa/operations/visits", icon: "bi-person-walking", resource: "spa_visits" },
      { name: "Appointments", href: "/dashboard/spa/operations/appointments", icon: "bi-calendar2-week", resource: "membership_appointments" },
      { name: "Sessions", href: "/dashboard/spa/operations/sessions", icon: "bi-stopwatch", resource: "membership_sessions" },
      { name: "Queue", href: "/dashboard/spa/operations/queue", icon: "bi-people", resource: "spa_queue" },
      { name: "Customer Requests", href: "/dashboard/spa/operations/customer-requests", icon: "bi-chat-left-text", resource: "spa_customer_requests" },
      { name: "Towel Management", href: "/dashboard/spa/operations/towel-management", icon: "bi-layers", resource: "spa_towels" },
      { name: "Service Orders", href: "/dashboard/spa/operations/service-orders", icon: "bi-receipt-cutoff", resource: "spa_service_orders" },
    ],
  },
  {
    name: "Gym",
    icon: "bi-heart-pulse",
    moduleCode: "membership",
    links: [
      { name: "Trainers", href: "/dashboard/spa/gym/trainers", icon: "bi-person-arms-up", resource: "gym_trainers" },
      { name: "Workout Plans", href: "/dashboard/spa/gym/workout-plans", icon: "bi-clipboard-check", resource: "gym_workout_plans" },
      { name: "Fitness Assessment", href: "/dashboard/spa/gym/fitness-assessments", icon: "bi-heart-pulse", resource: "gym_fitness_assessments" },
      { name: "Body Measurements", href: "/dashboard/spa/gym/body-measurements", icon: "bi-rulers", resource: "gym_body_measurements" },
      { name: "Classes", href: "/dashboard/spa/gym/classes", icon: "bi-calendar2-event", resource: "gym_classes" },
      { name: "Attendance", href: "/dashboard/spa/gym/attendance", icon: "bi-calendar-check", resource: "membership_attendance" },
    ],
  },
  {
    name: "Spa",
    icon: "bi-flower1",
    moduleCode: "membership",
    links: [
      { name: "Services", href: "/dashboard/spa/spa/services", icon: "bi-flower2", resource: "spa_services" },
      { name: "Therapists", href: "/dashboard/spa/spa/therapists", icon: "bi-person-heart", resource: "spa_therapists" },
      { name: "Treatment Rooms", href: "/dashboard/spa/spa/treatment-rooms", icon: "bi-door-closed", resource: "membership_facilities" },
      { name: "Bookings", href: "/dashboard/spa/spa/bookings", icon: "bi-calendar2-plus", resource: "membership_appointments" },
      { name: "Packages", href: "/dashboard/spa/spa/packages", icon: "bi-gift", resource: "spa_packages" },
    ],
  },
  {
    name: "Inventory",
    icon: "bi-boxes",
    moduleCode: "membership",
    links: [
      { name: "Products", href: "/dashboard/spa/inventory/products", icon: "bi-box-seam", resource: "inventory_products" },
      { name: "Consumables", href: "/dashboard/spa/inventory/consumables", icon: "bi-droplet", resource: "inventory_consumables" },
      { name: "Stock Usage", href: "/dashboard/spa/inventory/stock-usage", icon: "bi-box-arrow-up-right", resource: "inventory_stock_usage" },
      { name: "Suppliers", href: "/dashboard/spa/inventory/suppliers", icon: "bi-truck", resource: "inventory_suppliers" },
    ],
  },
  {
    name: "Staff",
    icon: "bi-person-workspace",
    moduleCode: "membership",
    links: [
      { name: "Employees", href: "/dashboard/spa/staff/employees", icon: "bi-person-vcard", resource: "staff_employees" },
      { name: "Schedules", href: "/dashboard/spa/staff/schedules", icon: "bi-calendar3", resource: "staff_schedules" },
      { name: "Commission", href: "/dashboard/spa/staff/commission", icon: "bi-percent", resource: "staff_commission" },
      { name: "Performance", href: "/dashboard/spa/staff/performance", icon: "bi-graph-up-arrow", resource: "staff_performance" },
    ],
  },
  {
    name: "Facilities",
    icon: "bi-building",
    moduleCode: "membership",
    links: [
      { name: "Rooms", href: "/dashboard/spa/facilities/rooms", icon: "bi-door-open", resource: "membership_facilities" },
      { name: "Lockers", href: "/dashboard/spa/facilities/lockers", icon: "bi-safe", resource: "facilities_lockers" },
      { name: "Equipment", href: "/dashboard/spa/facilities/equipment", icon: "bi-tools", resource: "facilities_equipment" },
      { name: "Maintenance", href: "/dashboard/spa/facilities/maintenance", icon: "bi-wrench-adjustable", resource: "facilities_maintenance" },
    ],
  },
  {
    name: "Reports",
    icon: "bi-bar-chart",
    moduleCode: "membership",
    links: [
      { name: "Membership", href: "/dashboard/spa/reports/membership", icon: "bi-person-badge", resource: "reports_membership" },
      { name: "Attendance", href: "/dashboard/spa/reports/attendance", icon: "bi-calendar-check", resource: "reports_attendance" },
      { name: "Service Orders", href: "/dashboard/spa/reports/service-orders", icon: "bi-receipt-cutoff", resource: "reports_service_orders" },
      { name: "Therapist", href: "/dashboard/spa/reports/therapist", icon: "bi-person-heart", resource: "reports_therapist" },
      { name: "Trainer", href: "/dashboard/spa/reports/trainer", icon: "bi-person-arms-up", resource: "reports_trainer" },
      { name: "Inventory", href: "/dashboard/spa/reports/inventory", icon: "bi-boxes", resource: "reports_inventory" },
    ],
  },
  {
    name: "Settings",
    icon: "bi-gear",
    adminOnly: true,
    links: [
      { name: "Users", href: "/dashboard/users", icon: "bi-people", resource: "users", adminOnly: true },
      { name: "Roles", href: "/dashboard/roles", icon: "bi-shield-lock", resource: "roles", adminOnly: true },
      { name: "Branches", href: "/dashboard/spa/settings/branches", icon: "bi-diagram-3", resource: "settings_branches", adminOnly: true },
      { name: "System", href: "/dashboard/system-settings", icon: "bi-sliders", resource: "settings", adminOnly: true },
    ],
  },
  {
    name: "Platform",
    icon: "bi-shield-lock",
    superAdminOnly: true,
    links: [
      { name: "Admin Dashboard", href: "/dashboard/admin", icon: "bi-speedometer2", resource: "companies", superAdminOnly: true },
      { name: "Companies", href: "/dashboard/companies", icon: "bi-building", resource: "companies", superAdminOnly: true },
      { name: "Demo Licenses", href: "/dashboard/demo-licenses", icon: "bi-key", resource: "demo_licenses", superAdminOnly: true },
      { name: "Audit Logs", href: "/dashboard/audit-logs", icon: "bi-journal-text", resource: "audit_logs", superAdminOnly: true },
      { name: "Manuals", href: "/dashboard/admin/manuals", icon: "bi-journal-bookmark", resource: "documents", superAdminOnly: true },
    ],
  },
];
