import type { SpaServiceOrder } from "@/lib/spa-service-orders";

function printDate(value: string): string {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en", { month: "short" });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${day}-${month}-${year} ${time}`;
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export default function ServiceOrderPrint({ order }: { order: SpaServiceOrder }) {
  const snapshot = order.service_snapshot;
  const services = snapshot.services.map((service) => ({
    ...service,
    unit_price: service.unit_price ?? null,
    line_total: service.line_total ?? (service.unit_price === null || service.unit_price === undefined ? null : Number((service.unit_price * service.quantity).toFixed(2))),
  }));
  const totalAmount = snapshot.total_amount ?? services.reduce((total, service) => total + (service.line_total || 0), 0);
  const hasPrices = services.some((service) => service.unit_price !== null);

  return (
    <article id="spa-service-order-print" className="service-order-slip" aria-label="Draft spa service order">
      <div className="slip-rule">================================</div>
      <h1>SPA SERVICE ORDER</h1>
      <div className="slip-rule">================================</div>
      <dl>
        <div><dt>Visit No</dt><dd>: {snapshot.visit_no}</dd></div>
        <div><dt>Customer</dt><dd>: {snapshot.customer_name}</dd></div>
        <div><dt>Therapist</dt><dd>: {snapshot.therapist_name}</dd></div>
        <div><dt>Date</dt><dd>: {printDate(snapshot.generated_at || order.generated_at)}</dd></div>
      </dl>
      <div className="slip-rule">--------------------------------</div>
      <ol className="slip-services">
        {services.map((service, index) => (
          <li key={`${service.code || service.name}-${index}`}>
            <span>{service.quantity}</span>
            <strong>{service.name}</strong>
            {hasPrices && (
              <span className="slip-line-price">{money(service.unit_price)}</span>
            )}
            {hasPrices && (
              <span className="slip-line-total">{money(service.line_total)}</span>
            )}
          </li>
        ))}
      </ol>
      <div className="slip-rule">--------------------------------</div>
      <p className="slip-total">Total Items : {order.total_items}</p>
      {hasPrices && <p className="slip-total">Total Amount : {money(totalAmount)} ETB</p>}
      <div className="slip-rule">--------------------------------</div>
      <p className="slip-warning">*** NOT A RECEIPT ***</p>
      <p className="slip-warning">*** PAYMENT AT CASHIER ***</p>
      <div className="slip-rule">================================</div>
    </article>
  );
}
