import { ok, withAuth } from "@/lib/api-utils";
import { listActiveTherapists, listActiveOfferings } from "@/lib/booking-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const url = new URL(req.url);
    const requestedCompany = Number(url.searchParams.get("company_id") || 0);
    const companyId =
      user.role === "super_admin" && requestedCompany > 0 ? requestedCompany : user.company_id;
    if (!companyId) return ok({ therapists: [], offerings: [] });

    const [therapists, offerings] = await Promise.all([
      listActiveTherapists(companyId),
      listActiveOfferings(companyId),
    ]);
    return ok({ therapists, offerings });
  });
}
