# Software Requirements Specification (SRS)

**Rotana Spa Management System**

| | |
|---|---|
| **Document** | Software Requirements Specification |
| **Project** | Rotana Spa Management System |
| **Version** | 1.0 |
| **Status** | Approved |
| **Prepared for** | Business owner / client |
| **Target market** | Ethiopian spa & gym operators (Addis Ababa) |

---

## 1. Introduction

### 1.1 Project Name
**Rotana Spa Management System**

### 1.2 Purpose
The Rotana Spa Management System is a web application that digitises the day-to-day operations of a spa and gym: member registration and membership plans, visits and treatments, therapist and trainer workloads, inventory and towels, facilities and gates, service orders handed to the cashier, and operational reports.

### 1.3 Scope
The system covers the following functional areas:

- **Customers** — member profiles, medical records, loyalty, visit history.
- **Membership** — plans, member registration, renewals, freeze/transfer, digital (RFID) cards, QR access passes.
- **Operations** — reception visits, appointments, sessions, queue, customer requests, towel management, and **service orders**.
- **Spa** — treatment catalogue (services), therapists, treatment rooms, bookings, packages.
- **Gym** — trainers, workout plans, fitness assessments, body measurements, classes, gym attendance.
- **Inventory** — products, consumables, stock usage, suppliers.
- **Staff** — employees, schedules, commission, performance.
- **Facilities** — rooms, lockers, equipment, maintenance, entry gates.
- **Reports** — membership, attendance, service orders, therapist, trainer, inventory.
- **Administration** — users, roles and permissions, system settings, audit logs, companies, demo licenses, notifications.

> **Architecture boundary — Sales/POS:** This application is an **operational** system. It does **not** create invoices, calculate prices, discounts or tax, accept payment, or connect to the separate Sales/POS database. Finishing a treatment produces an **80 mm draft Service Order** (visit, customer, therapist, service lines and quantities only) that the customer hands to the cashier, who completes the financial transaction in the separate POS application.

### 1.4 Objectives
- Provide one place for front-desk, therapist, trainer and management workflows.
- Replace manual/paper service tracking with a reliable, searchable record.
- Enforce role-based access control and keep a full audit trail.
- Produce operational reports without duplicating POS financial data.
- Support English and Amharic interfaces and Ethiopian Birr (ETB) currency.

### 1.5 Definitions and Abbreviations

| Term | Meaning |
|---|---|
| Visit | A reception check-in that carries a customer through check-in → assigned → in-treatment → finished. |
| Service order | A non-financial, draft list of treatment services and quantities generated when a visit finishes. |
| Member | A registered customer with a membership plan, card and/or QR pass. |
| RFID card | Digital membership card used at gates / gym. |
| QR pass | QR-based access pass for member or guest entry. |
| Rate card | The configured price of a service, session, day pass, facility or membership. |
| ETB | Ethiopian Birr, the default currency. |
| SPA-MGMT | The application's internal name for the licensed operations module. |

---

## 2. System Overview

### 2.1 Spa operation workflow

```
Front desk                Therapist / Treatment               Cashier (POS, separate)
-----------               ----------------------             ------------------------
Member/guest check-in  -> Assign therapist                 -> Receives draft order
Visit created             Start treatment                    Completes the payment
  (SPA-000001)            Record services used               in the separate POS app
                          Finish treatment
                          Generate service order (draft)
                          Print 80mm thermal slip
                          Hand order to cashier
```

1. Reception checks a customer (member or guest) into a **visit**.
2. A therapist is assigned; the visit moves to **in treatment**.
3. The therapist records the services performed (with quantities).
4. On **finish**, the system generates a **draft service order** with a snapshot of the services.
5. The slip is **printed** (58/80 mm thermal) and **handed to the cashier**.
6. The visit status becomes **handed_to_cashier**; the financial transaction happens in POS.

### 2.2 User roles

| Role | Description |
|---|---|
| `super_admin` | Platform owner. Manages companies, demo licenses, audit logs, manuals. Cannot create tenant records directly (no company). |
| `admin` | Company administrator. Full access to the company's data, users, roles, settings. |
| `manager` | Company manager. Operational access and approvals; limited administrative actions. |
| `receptionist` | Front desk: check-ins, appointments, registrations, queue, towels, service orders. |
| `guest` | Limited, view-only access. |
| `therapist` | Created via the Roles screen where needed; assigned treatment workflows. |

Permissions are enforced per **resource** and **action** (`view`, `create`, `edit`, `delete`, `approve`) through `role_permissions`.

### 2.3 Business rules

- A visit number is generated per company from `spa_visit_counters` (`SPA-000001`, `SPA-000002`, ...).
- A service order number is generated as `SO-SPA-000001`, ... per company.
- Only one visit may exist per appointment.
- Services may be added to a visit only after a therapist is assigned and treatment has **started**.
- A closed visit (`finished`, `order_printed`, `handed_to_cashier`, `cancelled`) cannot accept treatment changes.
- A service order can only be handed to the cashier after the visit is finished.
- Member `end_date` is required and defaults to 30 days when created without a plan.
- Super administrator must target an explicit `company_id` to create tenant records.
- Default currency is **ETB**; settings store company name, address, phone, email and currency.

---

## 3. Functional Requirements

Requirements are numbered `FR-n` with a priority of High (H), Medium (M) or Low (L).

### 3.1 Authentication & Users

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | The system shall authenticate users by email and password. | H |
| FR-002 | Passwords must be stored hashed (never plain text). | H |
| FR-003 | The system shall issue a JWT on login and accept it as `Authorization: Bearer <token>`. | H |
| FR-004 | The system shall offer role-based sign-in entry points: company admin, super admin, employee, guest. | M |
| FR-005 | An authenticated user's visible menu and pages must reflect their role permissions. | H |

### 3.2 Customer management

| ID | Requirement | Priority |
|---|---|---|
| FR-010 | The system shall register a customer as a member with name, phone, email, address, plan and start date. | H |
| FR-011 | The system shall generate a unique customer code (`MEM-001`, ...). | H |
| FR-012 | The system shall search customers by name, code, phone, and view visit history. | H |
| FR-013 | The system shall record medical records, loyalty tier/points and follow-ups. | M |
| FR-014 | The system shall display a member's plan, status (active/expired) and balance dates. | H |

### 3.3 Membership

| ID | Requirement | Priority |
|---|---|---|
| FR-020 | The system shall manage membership plans (spa, gym, cafe, general) with duration and active flag. | H |
| FR-021 | The system shall create subscriptions linking member + plan with start/end dates and billing cycle. | H |
| FR-022 | The system shall support renewals and freeze/transfer requests. | M |
| FR-023 | The system shall manage RFID digital cards (active/inactive/lost/expired). | M |
| FR-024 | The system shall issue QR passes with token, expiry, and max-uses tracking. | M |
| FR-025 | The system shall manage day tickets and rate cards (service, session, day pass, facility, membership). | M |

### 3.4 Operations — visits, appointments, service orders

| ID | Requirement | Priority |
|---|---|---|
| FR-030 | The system shall check a customer into a visit and generate a visit number. | H |
| FR-031 | The system shall assign an active therapist to a visit. | H |
| FR-032 | The system shall start and finish treatment, tracking timestamps. | H |
| FR-033 | The system shall record services used per visit with quantity. | H |
| FR-034 | On finish, the system shall generate a draft service order with a snapshot of service lines. | H |
| FR-035 | The system shall support re-printing and handing the order to the cashier. | H |
| FR-036 | The system shall create appointments with room/facility, service, start/end. | M |
| FR-037 | The system shall manage a queue and customer requests. | L |
| FR-038 | The system shall track towel issues and returns per visit. | M |

### 3.5 Spa catalogue

| ID | Requirement | Priority |
|---|---|---|
| FR-040 | The system shall maintain a service catalogue (name, category, duration). | H |
| FR-041 | The system shall maintain therapist profiles (specialties, certifications, commission). | H |
| FR-042 | The system shall manage treatment rooms and spa facilities. | M |
| FR-043 | The system shall manage packages. | L |

### 3.6 Gym

| ID | Requirement | Priority |
|---|---|---|
| FR-050 | The system shall maintain trainer profiles. | H |
| FR-051 | The system shall build workout plans per member (goal, sessions/week, exercises). | M |
| FR-052 | The system shall record fitness assessments and body measurements (BMI auto-calculated). | M |
| FR-053 | The system shall schedule classes with trainer, capacity and enrolment; derive full/open status. | M |
| FR-054 | The system shall record gym check-ins. | M |

### 3.7 Inventory

| ID | Requirement | Priority |
|---|---|---|
| FR-060 | The system shall maintain products and consumables with quantity and reorder level. | M |
| FR-061 | The system shall auto-derive stock status (in-stock / low-stock / out-of-stock). | M |
| FR-062 | The system shall record stock usage against services/visits. | L |
| FR-063 | The system shall maintain suppliers. | L |

### 3.8 Towels

| ID | Requirement | Priority |
|---|---|---|
| FR-070 | The system shall issue towels per visit (quantity, type). | M |
| FR-071 | The system shall record returns and derive status (issued / partially-returned / returned / lost). | M |

### 3.9 Printing

| ID | Requirement | Priority |
|---|---|---|
| FR-080 | The system shall print the service order as an 80 mm (or 58 mm) thermal slip. | H |
| FR-081 | The slip shall show visit, customer, therapist, service lines and quantities — no prices. | H |
| FR-082 | The system shall track `print_count` and `printed_at` per order. | M |

### 3.10 Reports

| ID | Requirement | Priority |
|---|---|---|
| FR-090 | The system shall provide a Membership report (status, plans, subscriptions). | H |
| FR-091 | The system shall provide an Attendance report (check-in volume, active visits). | H |
| FR-092 | The system shall provide a Service Orders report (draft/printed/handoff volume, item counts). | H |
| FR-093 | The system shall provide Therapist and Trainer reports (volume, usage). | M |
| FR-094 | The system shall provide an Inventory report (stock position, low stock, usage). | M |
| FR-095 | Reports shall filter by date range and company. | H |

### 3.11 Administration & notifications

| ID | Requirement | Priority |
|---|---|---|
| FR-100 | The system shall manage users and assign roles. | H |
| FR-101 | The system shall manage roles and per-resource permissions (view/create/edit/delete/approve). | H |
| FR-102 | The system shall maintain company settings (name, address, phone, email, currency). | H |
| FR-103 | The system shall log every create/update/delete to an audit trail with user, IP and old/new values. | H |
| FR-104 | The system shall support notifications per user (read/unread). | M |
| FR-105 | The super admin shall manage companies, demo licenses and audit logs. | H |

### 3.12 Internationalisation

| ID | Requirement | Priority |
|---|---|---|
| FR-110 | The system shall support English and Amharic. | M |
| FR-111 | The system shall allow switching the UI language. | M |

---

## 4. Non-functional requirements

### 4.1 Usability
- NFR-001: All primary workflows (check-in, add service, finish, print) must be reachable within two clicks from the dashboard.
- NFR-002: UI language and currency must be configurable.

### 4.2 Performance
- NFR-010: Common list/read pages must respond within ~1s on a typical connection.
- NFR-011: The system must support concurrent front-desk and therapist usage per company.

### 4.3 Security
- NFR-020: All API routes except login require a valid JWT.
- NFR-021: All queries must be parameterised (SQL-injection safe).
- NFR-022: Tenant data access must be scoped by `company_id`; users may only see their own company's data.
- NFR-023: Passwords must be hashed with a strong algorithm (bcrypt).

### 4.4 Reliability
- NFR-030: Audit logging must not block the primary transaction.
- NFR-031: Migration scripts must be idempotent where possible (`IF NOT EXISTS`).

### 4.5 Compatibility
- NFR-040: Must run on modern Chrome, Edge and Firefox.
- NFR-041: Must support 80 mm and 58 mm thermal receipt printers.

---

## 5. Constraints and assumptions

- **Assumption:** A separate Sales/POS application handles all pricing, tax and payment.
- **Constraint:** Super administrator cannot insert tenant rows without supplying a company.
- **Constraint:** Deployed on PostgreSQL 15+ (managed Neon database in this environment).
- **Assumption:** Data is stored per company; multi-tenant isolation is enforced in queries.

---

## 6. Acceptance criteria (summary)

1. A receptionist can check in a customer, assign a therapist, start treatment, record services and finish.
2. Finishing generates a draft service order that can be printed and handed to the cashier.
3. A member can be registered, assigned a plan and issued an RFID/QR pass.
4. All 5 roles see only the menu items and actions they are permitted to use.
5. Every create/update/delete appears in the audit log.
6. All six reports render for the selected date range with correct counts.
7. The interface renders correctly in English and Amharic.

---

## 7. Reference screens

See the companion documents:

- `PAGE_GUIDE.md` — screen-by-screen description.
- `USER_MANUAL.md` — step-by-step operator guide.
- `API_DOCUMENTATION.md` — API reference.
- `DATABASE_DESIGN.md` — database schema.
