import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Search } from "lucide-react";

const EVENT_COLORS = {
  login: "bg-blue-50 text-blue-700",
  register: "bg-[#FEE2E2] text-[#991B1B]",
  payment: "bg-[#FEF2F2] text-[#7F1D1D]",
  withdrawal_request: "bg-orange-50 text-orange-700",
  withdrawal_decision: "bg-[#FEF2F2] text-[#7F1D1D]",
  kyc_submit: "bg-indigo-50 text-indigo-700",
  kyc_decision: "bg-indigo-50 text-indigo-700",
  role_change: "bg-purple-50 text-purple-700",
  status_change: "bg-purple-50 text-purple-700",
  broadcast: "bg-pink-50 text-pink-700",
  settings_update: "bg-gray-100 text-gray-700",
  slider_create: "bg-[#FEE2E2] text-[#991B1B]",
  slider_update: "bg-[#FEE2E2] text-[#991B1B]",
  slider_delete: "bg-red-50 text-red-700",
  reel_create: "bg-[#FEE2E2] text-[#991B1B]",
  reel_update: "bg-[#FEE2E2] text-[#991B1B]",
  reel_delete: "bg-red-50 text-red-700",
};

export default function AdminAuditLogs() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [event, setEvent] = useState("");
  const [actorCode, setActorCode] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    const params = new URLSearchParams();
    if (event) params.set("event", event);
    if (actorCode) params.set("actor_code", actorCode);
    params.set("page", page);
    params.set("limit", limit);
    api.get(`/admin/audit-logs?${params}`).then(({ data }) => { setItems(data.items); setTotal(data.total); });
  }, [event, actorCode, page]);

  const events = Object.keys(EVENT_COLORS);

  return (
    <div className="space-y-6" data-testid="admin-audit-logs-page">
      <div>
        <h1 className="font-display text-3xl font-bold">Audit Logs</h1>
        <p className="text-sm text-[#64748B]">Track every key action across the platform — logins, payments, withdrawals, KYC, role changes, content edits.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input-soft max-w-xs" value={event} onChange={(e) => { setEvent(e.target.value); setPage(1); }} data-testid="audit-event-filter">
          <option value="">All events</option>
          {events.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]"/>
          <input className="input-soft pl-9 max-w-xs" placeholder="Filter by actor code…" value={actorCode} onChange={(e) => { setActorCode(e.target.value); setPage(1); }} data-testid="audit-actor-filter"/>
        </div>
        <div className="ml-auto text-sm text-[#64748B] self-center">Total: <b className="font-numbers text-[#7F1D1D]">{total}</b></div>
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F1F5F9] text-left text-xs uppercase">
            <tr>
              <th className="p-3">Time</th>
              <th>Event</th>
              <th>Actor</th>
              <th>Role</th>
              <th>Target</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-t border-[#F1F5F9]" data-testid={`audit-${l.id}`}>
                <td className="p-3 text-xs text-[#64748B] font-numbers whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                <td className="p-3"><span className={`badge-pill ${EVENT_COLORS[l.event] || "bg-gray-100 text-gray-700"}`}>{l.event}</span></td>
                <td className="p-3 font-numbers font-semibold">{l.actor_code || "—"}</td>
                <td className="p-3 capitalize text-xs">{l.actor_role || "—"}</td>
                <td className="p-3 text-xs">{l.target_label || l.target_id || "—"}</td>
                <td className="p-3 text-xs text-[#64748B]">{Object.keys(l.metadata || {}).length > 0 ? JSON.stringify(l.metadata) : "—"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="p-12 text-center text-[#64748B]">No logs found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn-outline text-sm">Prev</button>
          <span className="px-4 py-2 text-sm self-center">Page {page} of {Math.ceil(total / limit)}</span>
          <button onClick={() => setPage(page + 1)} disabled={page * limit >= total} className="btn-outline text-sm">Next</button>
        </div>
      )}
    </div>
  );
}
