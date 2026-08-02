import Link from "next/link";

export default function MembershipPaymentsBoundaryPage() {
  return (
    <div className="spa-workspace-page">
      <section className="pos-boundary-page">
        <span><i className="bi bi-shield-lock" /></span>
        <p>Separate Sales/POS Application</p>
        <h1>Payments are not recorded in the Spa system</h1>
        <div>
          <p>The Spa application manages visits, treatments, service usage, inventory and draft service orders only.</p>
          <p>Pricing, discounts, tax, payment collection and official receipts must be completed by the cashier in the separate Sales/POS application.</p>
        </div>
        <nav>
          <Link href="/dashboard/spa/operations/service-orders"><i className="bi bi-receipt-cutoff" /> View Service Orders</Link>
          <Link href="/dashboard/spa/operations/visits"><i className="bi bi-person-walking" /> View Visits</Link>
        </nav>
      </section>
    </div>
  );
}
