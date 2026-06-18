import { useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function AdminBroadcast() {
  const [form, setForm] = useState({ title: "", body: "", type: "info" });
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.post("/admin/notifications/broadcast", form); toast.success("Broadcast sent"); setForm({ title: "", body: "", type: "info" }); }
    catch { toast.error("Failed"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-6" data-testid="admin-broadcast-page">
      <h1 className="font-display text-3xl font-bold">Broadcast Notification</h1>
      <form onSubmit={send} className="card-soft p-6 max-w-2xl space-y-3">
        <input className="input-soft" placeholder="Title" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} required/>
        <textarea className="input-soft min-h-[100px]" placeholder="Message" value={form.body} onChange={(e) => setForm({...form, body: e.target.value})} required/>
        <select className="input-soft" value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}>
          <option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option><option value="error">Error</option>
        </select>
        <button disabled={busy} className="btn-primary" data-testid="broadcast-send-btn">{busy ? "Sending…" : "Send to All Members"}</button>
      </form>
    </div>
  );
}
