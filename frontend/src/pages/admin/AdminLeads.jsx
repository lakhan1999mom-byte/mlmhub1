import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Phone, Mail, Trash2, Check, MessageSquare } from "lucide-react";
import api from "@/lib/api";

const STATUSES = ["new", "contacted", "qualified", "converted", "rejected"];

export default function AdminLeads() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const load = () => api.get(`/admin/leads${status ? `?status=${status}` : ""}`).then(({ data }) => setItems(data.items));
  useEffect(() => { load(); }, [status]);

  const updateStatus = async (id, next) => {
    try { await api.put(`/admin/leads/${id}`, { status: next }); toast.success("Updated"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };
  const remove = async (id) => {
    if (!confirm("Delete this lead?")) return;
    try { await api.delete(`/admin/leads/${id}`); toast.success("Deleted"); load(); }
    catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-6" data-testid="admin-leads-page">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#7F1D1D]">Sales Agent Leads</h1>
        <p className="text-sm text-[#64748B]">Leads submitted via the Sales Agent page. Mark them as contacted / qualified / converted.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatus("")} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${!status ? "bg-[#DC2626] text-white border-[#B91C1C]" : "bg-white text-[#7F1D1D] border-[#FECACA] hover:border-[#DC2626]"}`} data-testid="leads-filter-all">All</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border capitalize ${status === s ? "bg-[#DC2626] text-white border-[#B91C1C]" : "bg-white text-[#7F1D1D] border-[#FECACA] hover:border-[#DC2626]"}`} data-testid={`leads-filter-${s}`}>{s}</button>
        ))}
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#FEF2F2] text-left text-xs uppercase">
            <tr>
              <th className="p-3">Received</th>
              <th>Name</th><th>Phone</th><th>City</th><th>Notes</th><th>Source</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-t border-[#FEE2E2]" data-testid={`lead-row-${l.id.slice(0, 8)}`}>
                <td className="p-3 text-xs text-[#64748B] font-numbers">{new Date(l.created_at).toLocaleString()}</td>
                <td className="p-3 font-semibold">{l.name}</td>
                <td className="p-3"><a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 text-[#B91C1C] hover:underline"><Phone className="w-3 h-3"/>{l.phone}</a></td>
                <td className="p-3">{l.city || "—"}</td>
                <td className="p-3 max-w-xs"><div className="line-clamp-2 text-xs">{l.notes || "—"}</div></td>
                <td className="p-3 text-xs text-[#64748B]">{l.source}</td>
                <td className="p-3">
                  <select
                    className="text-xs border border-[#FECACA] rounded-lg px-2 py-1"
                    value={l.status}
                    onChange={(e) => updateStatus(l.id, e.target.value)}
                    data-testid={`lead-status-${l.id.slice(0, 8)}`}
                  >
                    {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <a href={`https://wa.me/91${l.phone.replace(/[^0-9]/g, "").slice(-10)}`} target="_blank" rel="noreferrer" title="WhatsApp" className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#25D366] hover:opacity-90 px-2 py-1 rounded-lg"><MessageSquare className="w-3 h-3"/></a>
                    <button onClick={() => updateStatus(l.id, "converted")} title="Mark converted" className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] px-2 py-1 rounded-lg"><Check className="w-3 h-3"/></button>
                    <button onClick={() => remove(l.id)} title="Delete" className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded-lg"><Trash2 className="w-3 h-3"/></button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={8} className="p-12 text-center text-[#64748B]">No leads yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
