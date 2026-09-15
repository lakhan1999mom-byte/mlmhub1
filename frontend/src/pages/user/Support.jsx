import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function Support() {
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState({ subject: "", message: "" });
  const load = () => api.get("/tickets").then(({ data }) => setTickets(data));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/tickets", form);
    toast.success("Ticket created");
    setForm({ subject: "", message: "" });
    await load();
  };

  return (
    <div className="space-y-6" data-testid="support-page">
      <h1 className="font-display text-3xl font-bold">Support</h1>
      <form onSubmit={submit} className="card-soft p-6 space-y-3">
        <h3 className="font-display font-bold">Raise a Ticket</h3>
        <input className="input-soft" placeholder="Subject" value={form.subject} onChange={(e) => setForm({...form, subject: e.target.value})} required data-testid="ticket-subject"/>
        <textarea className="input-soft min-h-[100px]" placeholder="Describe your issue" value={form.message} onChange={(e) => setForm({...form, message: e.target.value})} required data-testid="ticket-message"/>
        <button className="btn-primary" data-testid="ticket-submit">Submit</button>
      </form>
      <div className="card-soft p-6">
        <h3 className="font-display font-bold mb-3">My Tickets</h3>
        {tickets.length === 0 ? <div className="text-sm text-[#64748B]">No tickets</div> : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="border-b border-[#F1F5F9] pb-3 last:border-0">
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[#7F1D1D]">{t.subject}</div>
                    <div className="text-sm text-[#334155]">{t.message}</div>
                    {t.admin_reply && <div className="mt-2 bg-[#FEE2E2] rounded-lg p-3 text-sm"><b>Admin:</b> {t.admin_reply}</div>}
                  </div>
                  <span className={`badge-pill capitalize h-fit ${t.status === "resolved" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#FEF2F2] text-[#7F1D1D]"}`}>{t.status}</span>
                </div>
                <div className="text-xs text-[#94A3B8] mt-1 font-numbers">{t.ticket_code} · {new Date(t.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
