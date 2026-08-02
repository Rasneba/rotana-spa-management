export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve";

export const RESOURCE_GROUPS: Record<string, { label: string; resources: string[] }> = {
  "HR Core": {
    label: "HR Core",
    resources: [
      "employees", "departments", "positions", "branches",
      "placements", "employment_stages", "shifts", "employee_shifts",
    ],
  },
  "People": {
    label: "People",
    resources: [
      "attendance", "leave", "overtime", "performance", "clearance", "termination",
    ],
  },
  "Payroll": {
    label: "Payroll & Finance",
    resources: [
      "payroll", "payroll_periods", "payroll_items", "vouchers", "voucher_items",
      "finance_accounts", "finance_journal", "finance_ledger", "finance_budget", "finance_payments",
    ],
  },
  "Stock": {
    label: "Stock & Inventory",
    resources: [
      "items", "item_categories", "warehouses",
      "stock_movements", "stock_adjustments", "stock_transfers",
    ],
  },
  "Sales": {
    label: "Sales",
    resources: [
      "sales_customers", "sales_orders", "sales_invoices",
      "sales_quotations", "sales_pos",
    ],
  },
  "Procurement": {
    label: "Procurement",
    resources: ["suppliers", "purchase_orders", "rfq"],
  },
  "Production": {
    label: "Production",
    resources: ["work_orders", "bom", "routings"],
  },
  "Membership": {
    label: "Membership",
    resources: [
      "membership_plans", "membership_members", "membership_payments", "membership_attendance",
      "membership_subscriptions", "membership_rate_cards", "membership_facilities",
      "membership_gates", "membership_rfid_cards", "membership_qr_passes",
      "membership_sessions", "membership_access_logs", "membership_day_tickets",
      "membership_appointments",
    ],
  },
  "System": {
    label: "System",
    resources: [
      "users", "roles", "settings", "id_definitions", "notifications",
      "documents", "reports", "audit_logs",
      "companies", "modules", "demo_licenses", "biometric_devices",
    ],
  },
};

export function getAllResources(): string[] {
  return Object.values(RESOURCE_GROUPS).flatMap((g) => g.resources);
}

export function getDefaultPermissions(): Record<string, boolean[]> {
  const all: Record<string, boolean[]> = {};
  const defaultActions = [false, false, false, false, false];
  for (const res of getAllResources()) {
    all[res] = [...defaultActions];
  }
  return all;
}
