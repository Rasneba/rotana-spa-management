export const VISIT_STATUSES = [
  "checked_in",
  "assigned",
  "in_treatment",
  "finished",
  "order_printed",
  "handed_to_cashier",
  "cancelled",
] as const;

export type VisitStatus = typeof VISIT_STATUSES[number];

export type VisitService = {
  id: number | string;
  visit_id: number | string;
  service_record_id: number | string;
  offering_id?: number | string | null;
  service_code: string | null;
  service_name: string;
  quantity: number;
  notes: string | null;
  created_at: string;
};

export type SpaVisit = {
  id: number | string;
  company_id: number;
  visit_no: string;
  member_id: number | null;
  appointment_id: number | null;
  facility_id?: number | null;
  customer_name: string;
  customer_phone: string | null;
  therapist_record_id: number | string | null;
  therapist_name: string | null;
  status: VisitStatus;
  checked_in_at: string;
  treatment_started_at: string | null;
  finished_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  services?: VisitService[];
  service_count?: number;
  total_items?: number;
  order_id?: number | string | null;
  order_status?: string | null;
  print_count?: number;
};

export type ServiceOrderItem = {
  code: string | null;
  name: string;
  quantity: number;
};

export type ServiceOrderSnapshot = {
  visit_no: string;
  customer_name: string;
  therapist_name: string;
  generated_at: string;
  notes: string;
  services: ServiceOrderItem[];
};

export type SpaServiceOrder = {
  id: number | string;
  company_id: number;
  visit_id: number | string;
  order_no: string;
  status: "draft" | "printed" | "handed_to_cashier" | "void";
  total_items: number;
  service_snapshot: ServiceOrderSnapshot;
  generated_at: string;
  printed_at: string | null;
  print_count: number;
  handed_to_cashier_at: string | null;
  created_at: string;
  updated_at: string;
};

export function humanizeStatus(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
