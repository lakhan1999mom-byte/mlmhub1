import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function Orders() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/orders").then(({ data }) => setList(data)); }, []);
  return (
    <div className="space-y-6" data-testid="orders-page">
      <h1 className="font-display text-3xl font-bold">My Orders</h1>
      {list.length === 0 ? (
        <div className="card-soft p-12 text-center text-[#64748B]">No orders yet</div>
      ) : (
        <div className="space-y-3">
          {list.map((o) => (
            <div key={o.id} className="card-soft p-5" data-testid={`order-${o.order_code}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <div className="font-display font-bold text-[#064E3B]">{o.order_code}</div>
                  <div className="text-xs text-[#64748B] font-numbers">{new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <span className={`badge-pill capitalize ${o.payment_status === "paid" ? "bg-[#ECFCCB] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>Payment: {o.payment_status}</span>
                  <span className={`badge-pill capitalize ${o.status === "delivered" ? "bg-[#ECFCCB] text-[#065F46]" : "bg-[#F1F5F9] text-[#334155]"}`}>Status: {o.status}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {o.items.map((it) => (
                  <div key={it.product_id} className="flex items-center gap-2 bg-[#FAFAF9] rounded-xl p-2 pr-4">
                    {it.image && <img src={it.image} alt="" className="w-10 h-10 rounded-lg object-cover"/>}
                    <div className="text-sm">
                      <div className="font-semibold text-[#064E3B]">{it.name}</div>
                      <div className="text-xs text-[#64748B]">x{it.quantity} · ₹{it.line_total}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between items-center pt-3 border-t border-[#F1F5F9]">
                <div className="text-sm">Total: <span className="font-numbers font-bold text-lg text-[#064E3B]">₹{o.total}</span></div>
                {o.tracking_no && <div className="text-xs text-[#65A30D]">Tracking: <b>{o.tracking_no}</b></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
