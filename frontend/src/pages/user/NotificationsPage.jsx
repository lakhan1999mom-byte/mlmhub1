import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Bell, CheckCheck } from "lucide-react";

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const load = () => api.get("/notifications").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await api.post("/notifications/read-all");
    await load();
  };
  const markOne = async (id) => {
    await api.post(`/notifications/${id}/read`);
    await load();
  };

  return (
    <div className="space-y-6" data-testid="notifications-page">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Bell className="w-7 h-7"/> Notifications</h1>
        <button onClick={markAll} className="btn-outline text-sm" data-testid="mark-all-read"><CheckCheck className="w-4 h-4"/> Mark all read</button>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="card-soft p-12 text-center text-[#64748B]">No notifications</div>
        ) : items.map((n) => (
          <button key={n.id} onClick={() => markOne(n.id)} className={`card-soft p-5 w-full text-left ${!n.read ? "border-l-4 border-l-[#84CC16]" : ""}`} data-testid={`notif-${n.id}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${n.type === "success" ? "bg-[#ECFCCB] text-[#65A30D]" : n.type === "warning" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#F1F5F9] text-[#334155]"}`}>
                <Bell className="w-4 h-4"/>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[#064E3B]">{n.title}</div>
                <div className="text-sm text-[#334155]">{n.body}</div>
                <div className="text-xs text-[#94A3B8] mt-1 font-numbers">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-[#84CC16] mt-2"/>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
