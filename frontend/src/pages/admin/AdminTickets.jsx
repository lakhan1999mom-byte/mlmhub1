import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function AdminTickets() {
  const [items, setItems] = useState([]);
  const load = () => api.get("/admin/tickets").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const reply = async (t) => {
    const r = window.prompt("Reply:", "");
    if (!r) return;
    await api.put(`/admin/tickets/${t.id}`, { admin_reply: r, status: "resolved" });
    toast.success("Replied");
    load();
  };

  return (
    <div className="space-y-6" data-testid="admin-tickets-page">
      <h1 className="font-display text-3xl font-bold">Support Tickets</h1>
      <div className="space-y-3">
        {items.map((t) => (
          <div key={t.id} className="card-soft p-5">
            <div className="flex justify-between items-start gap-3 mb-2">
              <div>
                <div className="font-display font-bold">{t.subject}</div>
                <div className="text-xs font-numbers text-[#64748B]">{t.ticket_code} · {t.user_name || t.user_code}</div>
              </div>
              <span className={`badge-pill capitalize ${t.status === "resolved" ? "bg-[#ECFCCB] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>{t.status}</span>
            </div>
            <p className="text-sm text-[#334155]">{t.message}</p>
            {t.admin_reply && <div className="mt-2 bg-[#ECFCCB] rounded-lg p-3 text-sm"><b>Reply:</b> {t.admin_reply}</div>}
            {t.status !== "resolved" && <button onClick={() => reply(t)} className="btn-primary text-sm mt-3" data-testid={`reply-${t.ticket_code}`}>Reply & Resolve</button>}
          </div>
        ))}
        {items.length === 0 && <div className="card-soft p-12 text-center text-[#64748B]">No tickets</div>}
      </div>
    </div>
  );
}
