import pool from "@/lib/db";
import { badRequest, created, err, ok, withAuth } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(req, async (user) => {
    const admin = user.role === "super_admin";
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const memberId = url.searchParams.get("member_id");
    try {
      let where = admin ? "TRUE" : "s.company_id=$1";
      const params: unknown[] = admin ? [] : [user.company_id];
      let index = admin ? 1 : 2;
      if (status) { where += ` AND s.status=$${index}`; params.push(status); index++; }
      if (memberId) { where += ` AND s.member_id=$${index}`; params.push(Number(memberId)); index++; }
      const result = await pool.query(
        `SELECT s.*, m.full_name AS member_name, m.customer_id AS member_code,
                COALESCE(o.title,p.name) AS plan_name,
                COALESCE(o.details->>'classification',p.type) AS plan_type,
                o.details->>'offering_code' AS offering_code
         FROM subscriptions s
         LEFT JOIN membership_members m ON m.id=s.member_id
         LEFT JOIN spa_management_records o
           ON o.id=s.offering_id AND o.module_key='catalog/offerings' AND o.deleted_at IS NULL
         LEFT JOIN membership_plans p ON p.id=s.plan_id
         WHERE ${where}
         ORDER BY s.created_at DESC`,
        params
      );
      return ok(result.rows);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unable to load memberships");
    }
  });
}

export async function POST(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { member_id, offering_id, start_date, end_date, billing_cycle, auto_renew } = body;
      if (!member_id || !offering_id || !end_date) return badRequest("Customer, offering and end date are required");
      const companyId = user.role === "super_admin" && body.company_id ? Number(body.company_id) : user.company_id;
      if (!companyId) return badRequest("A company is required");
      const [customer, offering] = await Promise.all([
        pool.query(`SELECT id FROM membership_members WHERE id=$1 AND company_id=$2`, [member_id, companyId]),
        pool.query(
          `SELECT id FROM spa_management_records
           WHERE id=$1 AND company_id=$2 AND module_key='catalog/offerings'
             AND details->>'classification' IN ('membership_plan','package','access_pass')
             AND status='active' AND deleted_at IS NULL`,
          [offering_id, companyId]
        ),
      ]);
      if (customer.rows.length === 0) return badRequest("Customer not found");
      if (offering.rows.length === 0) return badRequest("Active membership/package offering not found");
      const start = start_date || new Date().toISOString().slice(0, 10);
      const result = await pool.query(
        `INSERT INTO subscriptions
          (company_id, member_id, offering_id, start_date, end_date,
           billing_cycle, amount, auto_renew)
         VALUES ($1,$2,$3,$4,$5,$6,0,$7) RETURNING *`,
        [companyId, member_id, offering_id, start, end_date, billing_cycle || "monthly", auto_renew || false]
      );
      await pool.query(
        `UPDATE membership_members
         SET offering_id=$1, classification='member', start_date=$2,
             end_date=$3, status='active', updated_at=CURRENT_TIMESTAMP
         WHERE id=$4 AND company_id=$5`,
        [offering_id, start, end_date, member_id, companyId]
      );
      return created(result.rows[0]);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unable to create membership");
    }
  });
}

export async function PUT(req: Request) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { id, offering_id, end_date, billing_cycle, status, auto_renew } = body;
      if (!id) return badRequest("Membership ID is required");
      const admin = user.role === "super_admin";
      const result = await pool.query(
        `UPDATE subscriptions
         SET offering_id=COALESCE($1,offering_id), end_date=COALESCE($2,end_date),
             billing_cycle=COALESCE($3,billing_cycle), status=COALESCE($4,status),
             auto_renew=COALESCE($5,auto_renew)
         WHERE id=$6 AND ($7=true OR company_id=$8) RETURNING *`,
        [offering_id || null, end_date, billing_cycle, status, auto_renew, id, admin, user.company_id]
      );
      if (result.rows.length === 0) return badRequest("Membership not found");
      const subscription = result.rows[0];
      await pool.query(
        `UPDATE membership_members
         SET offering_id=COALESCE($1,offering_id), classification='member',
             end_date=COALESCE($2,end_date), status=CASE WHEN $3='active' THEN 'active' ELSE status END,
             updated_at=CURRENT_TIMESTAMP
         WHERE id=$4 AND company_id=$5`,
        [offering_id || null, end_date, status, subscription.member_id, subscription.company_id]
      );
      return ok(subscription);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unable to update membership");
    }
  });
}
