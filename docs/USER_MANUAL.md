# User Manual

**Dagi Spa Management System** — operator guide.

---

## 1. About this manual

This manual explains, step by step, how spa, gym and front-desk staff use the system every day. It is written for:

- **Reception / front desk** — check-ins, registrations, appointments, service orders.
- **Therapists & trainers** — treatment and class workflows.
- **Managers & admins** — reports, users, roles, settings.

## 2. Getting started

### 2.1 Signing in
1. Open the system URL in Chrome, Edge or Firefox.
2. Enter your **email** and **password**.
3. Click **Sign In**.

> Demo accounts (change passwords on first real use):
> - Company admin: `admin@dagispa.com` / `admin123`
> - Super admin: `super@dagispa.com` / `admin123`

### 2.2 The dashboard
After signing in you land on the **Dashboard**:
- **Quick actions** at the top: New Visit, New Booking, Register Member, Service Orders.
- **Spa Quick Stats**: Total Members, Today's Visits, In Treatment, Draft Orders.
- **Recent Members** list.
- The left **sidebar** groups all pages by module. You only see the groups your role allows.

### 2.3 Switching language
Use the **language switcher** (English / Amharic) on the login screen to change the interface language.

---

## 3. The visit — service-order workflow (core daily flow)

This is the most important workflow. It takes a customer from the front door to the cashier.

### 3.1 Check in a customer
1. Go to **Operations → Visits**.
2. Click **Check In** / **New Visit**.
3. Enter the customer name (and phone). If the customer is a **member**, choose the member — their name and phone are filled automatically.
4. Save. The system creates a visit with a number such as **SPA-000145** and status **checked_in**.

> Business rule: a visit may belong to one appointment. If a member's appointment already has a visit, the system returns the existing one.

### 3.2 Assign a therapist
1. Open the visit.
2. Choose **Assign Therapist**.
3. Select an **active therapist** from the list.
4. The visit moves to **assigned** and shows the therapist's name.

### 3.3 Start the treatment
1. Click **Start Treatment**.
2. The visit moves to **in treatment** and the start time is recorded.

### 3.4 Record services used
1. Click **Add Service**.
2. Pick a **service** from the catalogue and enter the **quantity** (e.g. Swedish Massage × 1).
3. Repeat for every treatment performed.

> Services can only be added after a therapist is assigned and the treatment has started.

### 3.5 Finish the treatment
1. Click **Finish**.
2. The visit status becomes **finished** and the finish time is recorded.
3. The system generates a **draft Service Order** (number such as **SO-SPA-000001**) with a snapshot of all services and quantities.

### 3.6 Print the slip
1. Open the service order.
2. Click **Print**.
3. An 80 mm (or 58 mm) thermal slip prints showing:

```
SERVICE ORDER (DRAFT)
Visit No : SPA-000145       02 Aug 2026 14:32
Customer : Ruth Desta
Therapist: Hana Bekele
------------------------------------
Swedish Massage 60min   x1
Moroccan Bath           x1
------------------------------------
Total items: 2
Please take this slip to the cashier.
```

The slip contains **no prices** — pricing and payment happen at the cashier in the POS application.

### 3.7 Hand to the cashier
1. Click **Hand to Cashier**.
2. The visit and order both move to **handed_to_cashier**.
3. Give the printed slip to the customer, who hands it to the cashier.

### 3.8 Cancelling a visit
- If a visit must be cancelled (before finishing), choose **Cancel**. The visit status becomes **cancelled** and can no longer accept treatment changes.

---

## 4. Customers

### 4.1 Register a member
1. Go to **Membership → Member Registration** (or **Customers → Customer Profiles → New**).
2. Enter **Full Name**, phone, email, ID number, address.
3. Choose a **Plan** (optional) and **Start Date**.
4. Save. A customer code such as **MEM-007** is generated automatically.

### 4.2 Find a customer
- Use **Customers → Customer Profiles** and type in the search box. Search works on name, code and phone.
- Open a profile to see contact details, plan, status and visit history.

### 4.3 Medical records & loyalty
- **Customers → Medical Records**: record allergies, conditions, consultations and follow-ups per customer.
- **Customers → Loyalty**: assign a tier (bronze/silver/gold/platinum) and track points.

---

## 5. Membership

| Task | Where | How |
|---|---|---|
| Create a plan | **Membership → Plans** | Name, type (spa/gym/cafe/general), duration days, max members, active. |
| Renew a member | **Membership → Renewals** | Open the expiring subscription and extend the end date. |
| Freeze / transfer | **Membership → Freeze / Transfer** | Choose request type, effective date, reason. |
| Issue digital card | **Membership → Digital Cards** | Add an RFID card (UID, type, expiry). Statuses: active/inactive/lost/expired. |
| Issue QR pass | **Membership → QR Access** | Pass type, expiry, max uses. |
| Day ticket | **Membership (classic) → Day Tickets** | Issue a one-day ticket for a guest. |

### Member status
- A member is **active** while today is within their start/end dates, and **expired** afterwards. Renewals extend the end date.

---

## 6. Appointments & bookings

1. Go to **Operations → Appointments** (or **Spa → Bookings**).
2. Click **New Appointment**.
3. Enter the customer/member, room or facility, service, start time and end time.
4. Save. The appointment can be converted into a visit at check-in.

---

## 7. Gym

### 7.1 Trainers
- **Gym → Trainers**: add trainers with specialties, certifications and commission rate. Statuses: active / on-leave / inactive.

### 7.2 Workout plans
- **Gym → Workout Plans**: create a plan per member — goal (strength, weight-loss, mobility…), start/end dates, sessions per week, exercises. Statuses: draft/active/paused/completed/cancelled.

### 7.3 Fitness assessments & body measurements
- **Gym → Fitness Assessment**: record fitness level, resting heart rate, blood pressure, body fat.
- **Gym → Body Measurements**: weight, height, chest, waist, hips. **BMI is calculated automatically.**

### 7.4 Classes
- **Gym → Classes**: schedule a class with trainer, location, start time, duration and capacity.
- Status is **derived automatically**: `scheduled` → `open` → `full` as enrolment reaches capacity.

### 7.5 Gym attendance
- **Gym → Attendance**: record member check-ins/check-outs at the gym.

---

## 8. Spa catalogue

| Page | Purpose |
|---|---|
| **Spa → Services** | Treatment catalogue: name, code, category (massage/facial/body-treatment/wellness/beauty/other), duration. Status: active/inactive. |
| **Spa → Therapists** | Therapist profiles: specialties, certifications, commission rate. |
| **Spa → Treatment Rooms** | Rooms/facilities used by appointments. |
| **Spa → Packages** | Package offers. |

---

## 9. Inventory

- **Inventory → Products / Consumables**: maintain items with quantity and reorder level.
- **Stock status is automatic**: `in-stock` → `low-stock` → `out-of-stock`.
- **Inventory → Stock Usage**: record what was consumed by services/visits.
- **Inventory → Suppliers**: supplier contact details.

---

## 10. Towel management

1. Go to **Operations → Towel Management**.
2. Issue towels for a visit: towel type (bath/hand/face/robe/other), quantity, issued at.
3. When towels come back, record **quantity returned**.
4. Status is derived automatically: `issued` → `partially-returned` → `returned` (or `lost`/`laundry`).

---

## 11. Staff & facilities

- **Staff → Employees**: staff profiles (name, role, contact).
- **Staff → Schedules**: shifts per employee.
- **Staff → Commission**: base amount + rate % → commission amount is calculated automatically.
- **Staff → Performance**: periodic ratings.
- **Facilities → Rooms / Lockers / Equipment / Maintenance**: facility register and maintenance tracking.

---

## 12. Reports

All reports share the same screen:

1. Pick a report from **Reports** menu: Membership, Attendance, Service Orders, Therapist, Trainer, Inventory.
2. Set the **date range** (from / to) and click apply.
3. Read the summary cards and the data table. Use the export/print button to save.

| Report | What it shows |
|---|---|
| Membership | Total/active/expired members, plan performance, subscription activity. |
| Attendance | Check-in volume, active visits, trends. |
| Service Orders | Draft/printed/handed-to-cashier volume and item counts (no financials). |
| Therapist | Treatments per therapist, service usage, completion. |
| Trainer | Classes and member activity per trainer. |
| Inventory | Stock position, low-stock items, usage. |

---

## 13. Administration (admin role)

### 13.1 Users
1. **Settings → Users**.
2. Add a user with name, email, role and active flag.
3. Deactivate leavers instead of deleting where possible.

### 13.2 Roles & permissions
1. **Settings → Roles**.
2. Open a role and toggle permissions per resource group: **View / Create / Edit / Delete / Approve**.
3. Save. Changes apply immediately.

### 13.3 System settings
1. **Settings → System**.
2. Edit company name, address, phone, email and **currency**.

### 13.4 Notifications
- The bell in the header shows unread notifications; mark them read as you review them.

---

## 14. Platform administration (super admin)

- **Platform → Companies**: create/manage tenant companies and enable modules.
- **Platform → Demo Licenses**: issue licenses with expiry dates.
- **Platform → Audit Logs**: review every action (user, table, old/new values, IP, time).
- **Platform → Admin Dashboard**: platform overview.

---

## 15. Tips & troubleshooting

| Situation | What to do |
|---|---|
| "A company is required" | Only a super admin can work without a company; target an explicit company. |
| "Active therapist not found" | The therapist must exist and have status `active`. |
| "Start the treatment before recording services used" | Assign a therapist and click **Start Treatment** first. |
| "This visit is already closed" | Closed visits (finished/handed off/cancelled) cannot be edited; create a new visit. |
| Slip does not print | Check the printer is selected in the browser print dialog and set to 80/58 mm thermal. |
| Wrong language | Use the language switcher; it applies immediately. |
| Forgotten password | Ask your admin to reset/update the user's password. |
| Missing menu items | Your role may not have the permission — ask your admin to review **Roles**. |

---

## 16. Glossary

| Term | Meaning |
|---|---|
| Visit | A check-in that tracks a customer through treatment (SPA-######). |
| Service order | Draft, non-financial slip of services handed to the cashier (SO-SPA-######). |
| Member | Registered customer with a membership plan/card/QR pass. |
| Rate card | Configured price of a service/session/pass. |
| ETB | Ethiopian Birr — default currency. |
| RFID card / QR pass | Member access credentials for gates/gym. |
