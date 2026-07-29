import { NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import { createToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { company_tin, email, password } = await req.json();

    if (!company_tin) {
      return NextResponse.json({ error: "Company TIN is required" }, { status: 400 });
    }

    // Look up company by TIN
    const companyRes = await pool.query(
      "SELECT id, name, tin, status FROM companies WHERE tin = $1",
      [company_tin]
    );

    if (companyRes.rows.length === 0) {
      return NextResponse.json({ error: "Company not found with this TIN" }, { status: 404 });
    }

    const company = companyRes.rows[0];

    if (company.status !== "active") {
      return NextResponse.json({ error: "Company account is not active" }, { status: 403 });
    }

    // Verify license is active (bypass for internal/enterprise companies)
    if (!['TIN-000001', 'TIN-ROTANA-001'].includes(company.tin)) {
      const licenseRes = await pool.query(
        "SELECT id, status, expiry_date FROM demo_licenses WHERE company_id = $1 AND status = 'active' AND expiry_date >= CURRENT_DATE ORDER BY expiry_date DESC LIMIT 1",
        [company.id]
      );
      if (licenseRes.rows.length === 0) {
        return NextResponse.json({ error: "No active license for this company" }, { status: 403 });
      }
    }

    // Look up user by email AND company_id
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND company_id = $2",
      [email, company.id]
    );

    const user = result.rows[0];

    if (!user) {
      return NextResponse.json({ error: "User not found for this company" }, { status: 404 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: "User account is disabled" }, { status: 403 });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const roleRes = await pool.query(
      "SELECT id, name FROM roles WHERE id = $1",
      [user.role_id]
    );
    const role = roleRes.rows[0] || null;
    const roleName = role?.name || user.role;

    const token = await createToken({
      id: user.id,
      email: user.email,
      role: roleName,
      company_id: company.id,
      company_name: company.name,
      company_tin: company.tin,
    });

    return NextResponse.json({
      message: "Login success",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleName,
        role_id: user.role_id,
        role_name: role?.name || null,
        branch_id: user.branch_id || null,
        company_id: company.id,
        company_name: company.name,
        company_tin: company.tin,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
