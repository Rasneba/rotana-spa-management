"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    const tok = localStorage.getItem("token");
    if (!tok) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${tok}` } });
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const deleteUser = async (id: number) => {
    if (!confirm("Delete this user?")) return;
    try {
      await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      loadUsers();
    } catch (err) { console.error(err); }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0">Users</h4>
        <Link href="/dashboard/users/add" className="btn btn-primary">
          <i className="bi bi-plus-lg me-1"></i>Add User
        </Link>
      </div>
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <table className="table table-hover mb-0">
            <thead className="table-dark">
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th style={{ width: "140px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-4"><div className="spinner-border text-primary" role="status"></div></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted py-4">No users found</td></tr>
              ) : (
                users.map((u: any) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td><span className="badge bg-info bg-opacity-25 text-info small">{u.company_name || "-"}</span></td>
                    <td><span className={`badge ${u.role_name === 'guest' ? 'bg-warning text-dark' : u.role_name === 'super_admin' ? 'bg-danger' : u.role_name === 'admin' ? 'bg-primary' : 'bg-secondary'}`}>{u.role_name || u.role}</span></td>
                    <td>{u.phone || "-"}</td>
                    <td>{u.is_active ? <span className="badge bg-success">Active</span> : <span className="badge bg-danger">Inactive</span>}</td>
                    <td>
                      <Link href={`/dashboard/users/edit/${u.id}`} className="btn btn-warning btn-sm me-1 text-white">
                        <i className="bi bi-pencil"></i>
                      </Link>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
