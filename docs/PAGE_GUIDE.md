# Page / UI Guide

**Rotana Spa Management System** — screen-by-screen definition.

Each page lists the route, who can see it (permission resource), the main widgets/actions, and the fields used. Most operational workspaces are rendered by a single dynamic page (`/dashboard/spa/[section]/[module]`) driven by a module definition — the fields below are the definitions for that module.

---

## 1. Login & entry

### `/login` (and `/`)
- Email + password form, sign-in button.
- Demo/entry variants: `POST /api/login` (admin), `/api/login/super-admin`, `/api/login/employee`, `/api/login/guest`, `/api/login/company`.
- On success the app stores `token` and `user` in `localStorage` and redirects to the dashboard (super admin → `/dashboard/admin`).
- **Language switcher** (English / Amharic) available before login.

## 2. Dashboard

### `/dashboard` (Dashboard)
- Greeting (time-of-day) and company name.
- **Quick actions:** New Visit, New Booking, Register Member, Service Orders.
- **Module cards:** Spa Management, Audit.
- **Spa Quick Stats:** Total Members, Today's Visits, In Treatment, Draft Orders (clickable).
- **Recent Members** table: code, name, plan, status badge (Active / Expired).

## 3. Customers

### `/dashboard/spa/customers/profiles` (Customer Profiles)
- Searchable list of members: customer code, full name, phone, plan, status, dates.
- Actions: view profile, register, edit.
- **`/dashboard/spa/customers/profiles/[id]`** — customer detail: contact, plan, visits, notes.

### `/dashboard/spa/customers/medical-records` (Medical Records)
Fields: Customer Name*, Member Code, Record Type (consultation/condition/allergy/medication/injury/other)*, Provider, Record Date*, Follow-up Date, Clinical Notes*.

### `/dashboard/spa/customers/visit-history` (Visit History)
- List of a customer's sessions/visits with dates, facility, duration, source.

### `/dashboard/spa/customers/loyalty` (Loyalty)
Fields: Customer Name*, Member Code, Tier (bronze/silver/gold/platinum)*, Available Points*, Lifetime Points, Enrolled On*, Notes.

## 4. Membership

### `/dashboard/membership/plans` (Membership Plans — classic)
- Grid/table of plans: name, type (gym/spa/cafe/general), duration days, max members, active flag.
- Create / edit / delete.

### `/dashboard/spa/membership/member-registration` (Member Registration)
Fields: Full Name*, Phone, Email, ID Number, Address, Plan, Start Date, Notes.
- Auto-generates `MEM-###` code when none is supplied.

### `/dashboard/spa/membership/renewals` (Renewals)
- List subscriptions approaching expiry; extend end date.

### `/dashboard/spa/membership/freeze-transfer` (Freeze / Transfer)
Fields: Member Name*, Member Code, Request Type (freeze/transfer)*, Effective Date*, Freeze End Date, Transfer To, Reason*.

### `/dashboard/spa/membership/digital-cards` (Digital Cards / RFID)
- List RFID cards: card UID, member, type, status (active/inactive/lost/expired), dates.

### `/dashboard/spa/membership/qr-access` (QR Access)
- QR passes: pass type, token, issued/expiry dates, max uses, current uses, status.

### Classic membership screens (also present)
- `/dashboard/membership/members`, `.../members/[id]`, `.../subscriptions`, `.../payments`, `.../rate-cards`, `.../facilities`, `.../gates`, `.../rfid-cards`, `.../qr-passes`, `.../day-tickets`, `.../sessions`, `.../attendance`, `.../schedule`, `.../access-logs`, `.../gym`.

## 5. Operations

### `/dashboard/spa/operations/visits` (Visits — reception)
- Table of visits: visit no, customer, therapist, status, check-in time.
- **Check in** a customer (member or guest).
- Visit status flow: `checked_in` → `assigned` → `in_treatment` → `finished` → `order_printed` → `handed_to_cashier` (or `cancelled`).
- **`/dashboard/spa/operations/visits/[id]`** — visit detail + treatment workspace:
  - Assign therapist, start treatment.
  - Add service lines (service, quantity).
  - Finish → generate service order, print, hand to cashier.

### `/dashboard/spa/operations/appointments` (Appointments / Bookings)
Fields: customer/member, facility/room, service, start time, end time, status, notes.

### `/dashboard/spa/operations/sessions` (Sessions)
- Active session list with check-in/check-out and duration.

### `/dashboard/spa/operations/queue` (Queue)
Fields: Customer Name*, Service*, Assigned To, Priority (normal/priority/urgent)*, Joined At*, Estimated Minutes, Notes.

### `/dashboard/spa/operations/customer-requests` (Customer Requests)
Fields: Customer Name*, Request Type (booking/reschedule/facility/service-order/complaint/special-assistance/other)*, Channel, Requested For, Assigned To, Details*, Resolution.

### `/dashboard/spa/operations/towel-management` (Towel Management)
Fields: Visit Number*, Customer Name*, Towel Type (bath/hand/face/robe/other)*, Quantity Issued*, Quantity Returned, Issued At*, Returned At, Notes.
- Status derived: issued / partially-returned / returned / lost.

### `/dashboard/spa/operations/service-orders` (Service Orders)
- List of draft orders: order no, visit, customer, status (draft/printed/handed_to_cashier/void), item count.
- Print, re-print, view slip.

## 6. Gym

| Page | Route | Fields |
|---|---|---|
| Trainers | `/dashboard/spa/gym/trainers` | Full Name*, Phone, Email, Specialties*, Certifications, Hire Date, Commission Rate (%) |
| Workout Plans | `/dashboard/spa/gym/workout-plans` | Plan Name*, Member Name*, Trainer, Goal, Start Date*, End Date, Sessions/Week, Exercises* |
| Fitness Assessment | `/dashboard/spa/gym/fitness-assessments` | Member Name*, Trainer*, Assessment Date*, Fitness Level, Resting Heart Rate, Blood Pressure, Body Fat %, Notes |
| Body Measurements | `/dashboard/spa/gym/body-measurements` | Member Name*, Measured On*, Weight, Height, BMI (auto), Chest, Waist, Hips, Body Fat % |
| Classes | `/dashboard/spa/gym/classes` | Class Name*, Trainer*, Location, Starts At*, Duration*, Capacity*, Enrolled, Notes |
| Attendance | `/dashboard/spa/gym/attendance` | Gym check-in log with check-in/out times. |

Class status is derived: scheduled / open / full / in-progress / completed / cancelled.

## 7. Spa

| Page | Route | Fields |
|---|---|---|
| Services | `/dashboard/spa/spa/services` | Service Name*, Service Code, Category (massage/facial/body-treatment/wellness/beauty/other)*, Duration (min)*, Description |
| Therapists | `/dashboard/spa/spa/therapists` | Full Name*, Phone, Email, Specialties*, Certifications, Commission Rate (%), Hire Date |
| Treatment Rooms | `/dashboard/spa/spa/treatment-rooms` | Rooms/facilities list (type, capacity, active) |
| Bookings | `/dashboard/spa/spa/bookings` | Appointment/booking calendar |
| Packages | `/dashboard/spa/spa/packages` | Package catalogue |

## 8. Inventory

| Page | Route | Fields |
|---|---|---|
| Products | `/dashboard/spa/inventory/products` | Name*, SKU, Category, Quantity*, Unit, Reorder Level, Unit Cost |
| Consumables | `/dashboard/spa/inventory/consumables` | Name*, Category, Quantity, Reorder Level, Unit |
| Stock Usage | `/dashboard/spa/inventory/stock-usage` | Item, quantity used, linked service/visit |
| Suppliers | `/dashboard/spa/inventory/suppliers` | Name*, Contact, Phone, Email |

Stock status is derived: in-stock / low-stock / out-of-stock.

## 9. Staff

| Page | Route | Fields |
|---|---|---|
| Employees | `/dashboard/spa/staff/employees` | Full Name*, Phone, Email, Role, Employment Date |
| Schedules | `/dashboard/spa/staff/schedules` | Employee, day, shift times |
| Commission | `/dashboard/spa/staff/commission` | Employee, Base Amount, Rate % → Commission Amount (auto) |
| Performance | `/dashboard/spa/staff/performance` | Employee, period, rating/notes |

## 10. Facilities

| Page | Route | Fields |
|---|---|---|
| Rooms | `/dashboard/spa/facilities/rooms` | Name*, Type, Capacity, Description, Active |
| Lockers | `/dashboard/spa/facilities/lockers` | Locker no, assigned member, status |
| Equipment | `/dashboard/spa/facilities/equipment` | Item, condition, maintenance due |
| Maintenance | `/dashboard/spa/facilities/maintenance` | Item, issue, priority, status |

## 11. Reports

All reports share the same layout: **date range filter (from/to)** → summary cards → data table → export.

| Report | Route | Contents |
|---|---|---|
| Membership | `/dashboard/spa/reports/membership` | Total/active/expired members, plans, subscription performance |
| Attendance | `/dashboard/spa/reports/attendance` | Check-in volume, active visits, attendance trends |
| Service Orders | `/dashboard/spa/reports/service-orders` | Draft/printed/handoff volume, item counts (no financials) |
| Therapist | `/dashboard/spa/reports/therapist` | Treatment volume, service usage, completion trends |
| Trainer | `/dashboard/spa/reports/trainer` | Class assignments, member activity |
| Inventory | `/dashboard/spa/reports/inventory` | Stock position, low stock, usage |

## 12. Settings & Administration

### `/dashboard/users` (+ `/users/add`, `/users/edit/[id]`)
- List users; create/edit with name, email, role, phone, active.
- Fields: Full Name*, Email*, Role*, Phone, Active.

### `/dashboard/roles` (Roles & Permissions)
- Role list; per-role permission matrix grouped by resource group (Dashboard, Customers, Membership, Operations, Gym, Spa, Inventory, Staff, Facilities, Reports, System).
- Each resource row: view / create / edit / delete / approve toggles.

### `/dashboard/system-settings` (System)
- Company settings: name, address, phone, email, currency.

### `/dashboard/audit` / `/dashboard/audit/activity` / `/dashboard/audit-logs` (Audit)
- Table of audit events: user, action (CREATE/UPDATE/DELETE), table, record id, old/new values, IP, user agent, timestamp.

### `/dashboard/settings/id-definitions` (ID Definitions)
- Numbering rules per entity: prefix, separator, padding, start, reset type, pattern.

### Platform (super admin only)
- `/dashboard/admin` — Admin dashboard.
- `/dashboard/companies` — Company management (name, code, address, TIN, status, modules).
- `/dashboard/demo-licenses` — License keys with expiry and status.
- `/dashboard/admin/manuals` / `issued-manuals` — Manual documents.

## 13. Notifications

- Bell icon in the header; list of notifications with title, message, type, read/unread.

---

## Shared UI components

| Component | Purpose |
|---|---|
| `DataTable` | Sortable, searchable table for list pages. |
| `SearchInput` | Header search box. |
| `StatCard` | KPI card on dashboards and reports. |
| `StatusBadge` | Colour-coded status (active/expired/draft/printed/in treatment, etc.). |
| `FormField` | Labelled form input with validation. |
| `ConfirmDialog` | Delete confirmation modal. |
| `EmptyState` | Friendly empty list placeholder. |
| `PageHeader` | Page title + actions. |
| `ReportFilters` | Date-range filter used by all reports. |
