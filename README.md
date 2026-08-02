This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Spa management database

The expanded Customers, Gym, Spa, Inventory, Staff, Facilities, and Reports workspaces require migrations v33 and v34 after the existing spa migrations:

```bash
psql "$DATABASE_URL" -f db-migration-v33.sql
psql "$DATABASE_URL" -f db-migration-v34.sql
psql "$DATABASE_URL" -f db-migration-v35.sql
```

Migration v34 adds the reception visit, therapist treatment, service-line, and draft service-order workflow. Migration v35 adds the adapted Spa/Gym access dashboard, enhanced gates, operational cameras, controller command queue, kiosk QR passes, and access-audit context.

### In-app user guide

The searchable, printable single-page system guide is available at `/dashboard/guide`. It is linked directly in the sidebar and through the header help icon.

### Adapted access components

The consolidated **Spa & Gym Access** menu adapts only the pictured components from [`Rasneba/-geniouserp`](https://github.com/Rasneba/-geniouserp). Gates, camera/webcam support, QR scanning, access monitoring, kiosk check-in and dashboard patterns are fully or partially merged. Parking tables, ANPR, vehicle logic, pricing and payment code are not imported; retained source labels route to the corresponding Spa/Gym records.

### Sales/POS boundary

The Spa application does **not** connect to the Sales/POS database and does not calculate prices, discounts, tax, payments, invoices, or official receipts. Finishing a treatment produces an 80 mm **Service Order (Draft)** containing visit, customer, therapist, and service quantities only. The customer takes that draft to the cashier, who completes the financial transaction in the separate POS application.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
