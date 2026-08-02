export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve";

export const RESOURCE_GROUPS: Record<string, { label: string; resources: string[] }> = {
  "Dashboard": {
    label: "Dashboard",
    resources: ["dashboard"],
  },
  "Customers": {
    label: "Customers",
    resources: ["membership_members", "spa_medical_records", "spa_loyalty"],
  },
  "Membership": {
    label: "Membership",
    resources: [
      "membership_plans", "membership_subscriptions", "membership_freeze_transfer",
      "membership_rfid_cards", "membership_qr_passes", "membership_day_tickets",
      "membership_rate_cards",
    ],
  },
  "Operations": {
    label: "Operations",
    resources: [
      "membership_attendance", "membership_appointments", "membership_sessions",
      "membership_access_logs", "spa_visits", "spa_visit_services",
      "spa_service_orders", "spa_queue", "spa_customer_requests", "spa_towels",
    ],
  },
  "Gym": {
    label: "Gym",
    resources: [
      "gym_trainers", "gym_workout_plans", "gym_fitness_assessments",
      "gym_body_measurements", "gym_classes",
    ],
  },
  "Spa": {
    label: "Spa",
    resources: ["spa_services", "spa_therapists", "spa_packages"],
  },
  "Inventory": {
    label: "Inventory",
    resources: [
      "inventory_products", "inventory_consumables", "inventory_stock_usage", "inventory_suppliers",
    ],
  },
  "Staff": {
    label: "Staff",
    resources: ["staff_employees", "staff_schedules", "staff_commission", "staff_performance"],
  },
  "Facilities": {
    label: "Facilities",
    resources: [
      "membership_facilities", "membership_gates", "facilities_lockers",
      "facilities_equipment", "facilities_maintenance",
    ],
  },
  "Reports": {
    label: "Reports",
    resources: [
      "reports_membership", "reports_attendance", "reports_service_orders",
      "reports_therapist", "reports_trainer", "reports_inventory",
    ],
  },
  "System": {
    label: "System & Administration",
    resources: [
      "users", "roles", "settings", "settings_branches", "id_definitions",
      "notifications", "documents", "reports", "audit_logs", "companies",
      "modules", "demo_licenses", "biometric_devices",
    ],
  },
};

export function getAllResources(): string[] {
  return Object.values(RESOURCE_GROUPS).flatMap((group) => group.resources);
}

export function getDefaultPermissions(): Record<string, boolean[]> {
  const permissions: Record<string, boolean[]> = {};
  for (const resource of getAllResources()) {
    permissions[resource] = [false, false, false, false, false];
  }
  return permissions;
}
