# Client Presentation

**Dagi Spa Management System**
*Presented to the business owner / client*

---

## 1. The problem

Spa and gym operators face daily operational pain:

- **Manual service tracking** — treatments are recorded on paper and easily lost.
- **Lost treatment history** — no reliable record of what each customer received, when, and by whom.
- **No towel accountability** — towels are issued and never counted or returned.
- **Difficult therapist monitoring** — no visibility into who is treating whom, when, or how busy the team is.
- **Slow, duplicate data entry** — member details are re-typed at every visit.
- **No control over who can see or change what** — every staff member can see everything.

## 2. The solution

The **Dagi Spa Management System** is a web application that digitises the whole front of house:

| Area | What it gives you |
|---|---|
| **Customer management** | One searchable profile per customer — contact details, medical notes, loyalty, and full visit history. |
| **Membership** | Plans, renewals, freeze/transfer, RFID digital cards and QR passes. |
| **Therapist workflow** | Visits are checked in at reception, assigned to a therapist, started, treated and finished — with timestamps at every step. |
| **Service tracking** | Every treatment performed is recorded against the visit with quantities. |
| **Service order handoff** | Finishing a treatment prints a clean 80 mm draft slip (visit, customer, therapist, services) that the customer hands to the cashier. |
| **Inventory control** | Products and consumables with stock levels and automatic low-stock warnings. |
| **Towel / laundry tracking** | Issue, return and lost-towel management per visit. |
| **Gym** | Trainers, workout plans, fitness assessments, body measurements, classes and attendance. |
| **Roles & permissions** | Every user sees only what their job needs — reception, therapist, manager or admin. |
| **Audit trail** | Every create, edit and delete is logged with who did it and when. |

## 3. Benefits

- **Faster customer service** — check-in takes seconds; history is one search away.
- **Reduced mistakes** — no more lost paper slips or re-typed customer details.
- **Better stock control** — know exactly what is used, what is low, and what to reorder.
- **Better reporting** — membership, attendance, service-order, therapist, trainer and inventory reports at the click of a button.
- **Accountability** — therapists, towels and services are all traceable.
- **Clean handoff to POS** — the draft service order removes manual re-entry for the cashier without duplicating financial systems.

## 4. How it fits with your sales (POS)

The Spa system is deliberately **operational, not financial**. It does **not** price treatments, charge customers, calculate tax or print invoices. When a treatment finishes it prints a **draft service order**:

```
DAGI SPA  --  SERVICE ORDER (DRAFT)
Visit No : SPA-000145        Date: 02 Aug 2026 14:32
Customer : Ruth Desta
Therapist: Hana Bekele
------------------------------------
Swedish Massage 60min   x1
Moroccan Bath           x1
------------------------------------
Total items: 2
Please take this slip to the cashier.
```

The customer takes the slip to the cashier, who completes the payment in the existing POS application. This keeps one source of truth for money and one for operations.

## 5. Security and control

- Password-protected login; passwords are stored hashed.
- Five roles: super admin, admin, manager, receptionist, guest.
- Every screen and action is protected by a permission.
- Every change is written to an audit log that the platform owner can review.
- Data is isolated per company — each spa only ever sees its own data.

## 6. What the system supports today

- English and **Amharic** interfaces.
- **Ethiopian Birr (ETB)** pricing and currency setting.
- 80 mm / 58 mm **thermal printer** support for service orders.
- Multi-branch and multi-company hosting (platform owner manages companies).
