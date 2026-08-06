import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Users, Briefcase, ShoppingBag, Sparkles, Command } from "lucide-react";
import api from "@/lib/api";

/**
 * Global admin command palette — opens with Cmd/Ctrl-K or the top-bar search.
 * Searches across users, referral businesses and orders.
 */
export default function AdminSearchPalette({ open, onClose }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState({ users: [], businesses: [], orders: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    if (open) {
      setQ("");
      setData({ users: [], businesses: [], orders: [], total: 0 });
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 1) { setData({ users: [], businesses: [], orders: [], total: 0 }); return; }
    setLoading(true);
    const t = setTimeout(() => {
      api.get(`/admin/search?q=${encodeURIComponent(term)}&limit=6`)
        .then(({ data }) => setData(data))
        .catch(() => setData({ users: [], businesses: [], orders: [], total: 0 }))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  const go = (path) => { onClose(); nav(path); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
      onClick={onClose}
      data-testid="admin-search-palette"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          <Search className="w-5 h-5 text-[#84CC16]"/>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users, businesses, orders — name, phone, email, code…"
            className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 outline-none font-medium"
            data-testid="admin-search-input"
          />
          <span className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1"><Command className="w-3 h-3"/> K</span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200" data-testid="admin-search-close"><X className="w-4 h-4"/></button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-3">
          {loading && <div className="text-center py-6 text-slate-400 text-sm">Searching…</div>}
          {!loading && q.trim().length === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm">
              <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-40"/>
              Try searching by name, phone, referral code or order number.
            </div>
          )}
          {!loading && q.trim().length > 0 && data.total === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm">No matches for &quot;{q}&quot;</div>
          )}

          {data.users.length > 0 && (
            <Section title="Users" count={data.users.length} icon={<Users className="w-3 h-3"/>}>
              {data.users.map((u) => (
                <Row key={u.id} onClick={() => go(`/admin/users/${u.id}`)} testid={`palette-user-${u.user_code}`}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#84CC16] to-[#65A30D] text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {(u.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-100 text-sm font-semibold truncate">{u.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">{u.user_code} · {u.phone || u.email} · Ref {u.referral_code || "—"}</div>
                  </div>
                  <span className={`badge-pill text-[9px] ${u.is_joining_paid ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30" : "bg-amber-950/60 text-amber-300 border border-amber-500/30"}`}>{u.is_joining_paid ? "Active" : "Pending"}</span>
                </Row>
              ))}
            </Section>
          )}

          {data.businesses.length > 0 && (
            <Section title="Referral Businesses" count={data.businesses.length} icon={<Briefcase className="w-3 h-3"/>}>
              {data.businesses.map((b) => (
                <Row key={b.id} onClick={() => go(`/admin/users/${b.owner_user_id}`)} testid={`palette-biz-${b.business_code}`}>
                  <div className="w-8 h-8 rounded-2xl bg-slate-800 text-[#84CC16] flex items-center justify-center shrink-0"><Briefcase className="w-4 h-4"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-100 text-sm font-semibold truncate">{b.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">{b.business_code} · Ref {b.referral_code} · Owner {b.owner?.user_code || "—"}</div>
                  </div>
                  <span className={`badge-pill text-[9px] ${b.is_active ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30" : "bg-amber-950/60 text-amber-300 border border-amber-500/30"}`}>{b.is_active ? "Active" : "Pending"}</span>
                </Row>
              ))}
            </Section>
          )}

          {data.orders.length > 0 && (
            <Section title="Orders" count={data.orders.length} icon={<ShoppingBag className="w-3 h-3"/>}>
              {data.orders.map((o) => (
                <Row key={o.id} onClick={() => go(`/admin/orders`)} testid={`palette-order-${o.order_code}`}>
                  <div className="w-8 h-8 rounded-2xl bg-slate-800 text-[#84CC16] flex items-center justify-center shrink-0"><ShoppingBag className="w-4 h-4"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-100 text-sm font-semibold truncate">{o.order_code}</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">₹{o.total} · {o.status} · {o.payment_status}</div>
                  </div>
                </Row>
              ))}
            </Section>
          )}
        </div>

        <div className="border-t border-slate-800 px-4 py-2 text-[10px] uppercase tracking-widest text-slate-500 flex items-center justify-between">
          <span>Press ↵ to open · Esc to close</span>
          <span>Live search</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, count, icon, children }) {
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1 px-2 pb-1">
        {icon} {title} <span className="text-slate-600">· {count}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ onClick, children, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-800 border border-transparent hover:border-[#84CC16]/40 transition-colors text-left"
    >
      {children}
    </button>
  );
}
