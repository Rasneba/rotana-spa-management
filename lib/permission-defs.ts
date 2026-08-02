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
  "Offering Catalog": {
    label: "Offering Master",
    resources: ["catalog_offerings"],
  },
  "Membership": {
    label: "Membership",
    resources: ["membership_subscriptions", "membership_freeze_transfer"],
  },
  "Operations": {
    label: "Operations",
    resources: [
      "membership_attendance", "membership_appointments", "membership_sessions",
      "spa_visits", "spa_visit_services",
      "spa_service_orders", "spa_queue", "spa_customer_requests", "spa_towels",
    ],
  },
  "Access": {
    label: "Spa & Gym Access",
    resources: [
      "access_zones", "membership_gates", "access_cameras", "membership_rfid_cards", "membership_access_logs",
      "membership_qr_passes", "access_control", "access_kiosk",
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
    resources: ["spa_therapists"],
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
      "membership_facilities", "facilities_lockers",
      "facilities_equipment", "facilities_maintenance",
    ],
  },
  "Reports": {
    label: "Reports",
    resources: [
      "reports_access", "reports_membership", "reports_attendance", "reports_service_orders",
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
