import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, ChevronRight, Truck, Clock } from "lucide-react";
import api from "@/lib/api";

const STATUS_TONE = {
  placed: { bg: "bg-[#FEE2E2]", text: "text-[#1D4ED8]", label: "Order Placed" },
  confirmed: { bg: "bg-[#DDD6FE]", text: "text-[#5B21B6]", label: "Confirmed" },
  packed: { bg: "bg-[#FCA5A5]", text: "text-[#7F1D1D]", label: "Packed" },
  shipped: { bg: "bg-[#BAE6FD]", text: "text-[#0369A1]", label: "Shipped" },
  out_for_delivery: { bg: "bg-[#FEE2E2]", text: "text-[#7F1D1D]", label: "Out for Delivery" },
  delivered: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", label: "Delivered" },
  cancelled: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", label: "Cancelled" },
};

export default function Orders() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/orders").then(({ data }) => setList(data)); }, []);
  return (
    <div className="space-y-6" data-testid="orders-page">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#7F1D1D]">My Orders</h1>
        <p className="text-sm text-[#64748B]">Click any order to see live tracking updates.</p>
      </div>
      {list.length === 0 ? (
        <div className="card-soft p-12 text-center">
          <Package className="w-14 h-14 text-[#DC2626] mx-auto mb-3"/>
          <div className="font-display font-bold text-lg text-[#7F1D1D]">No orders yet</div>
          <div className="text-sm text-[#64748B] mb-4">When you buy the kit or any product, orders show up here with live tracking.</div>
          <Link to="/products" className="btn-primary mx-auto inline-flex">Shop Now</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((o) => {
            const tone = STATUS_TONE[o.status] || STATUS_TONE.placed;
            const lastEvent = o.tracking_history?.[o.tracking_history.length - 1];
            return (
              <Link
                to={`/orders/${o.id}`}
                key={o.id}
                className="block card-soft p-5 hover:-translate-y-0.5 hover:shadow-lg transition-all group"
                data-testid={`order-${o.order_code}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="font-display font-bold text-[#7F1D1D] group-hover:text-[#B91C1C] transition-colors">{o.order_code}</div>
                    <div className="text-xs text-[#64748B] font-numbers flex items-center gap-1">
                      <Clock className="w-3 h-3"/> {new Date(o.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className={`badge-pill capitalize ${o.payment_status === "paid" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#FEF2F2] text-[#7F1D1D]"}`}>{o.payment_status}</span>
                    <span className={`badge-pill ${tone.bg} ${tone.text} inline-flex items-center gap-1`}>
                      <Truck className="w-3 h-3"/> {tone.label}
                    </span>
                    <ChevronRight className="w-5 h-5 text-[#DC2626] group-hover:translate-x-1 transition-transform"/>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {o.items.map((it) => (
                    <div key={it.product_id} className="flex items-center gap-2 bg-[#FAFAF9] rounded-xl p-2 pr-4">
                      {it.image && <img src={it.image} alt="" className="w-10 h-10 rounded-lg object-cover"/>}
                      <div className="text-sm">
                        <div className="font-semibold text-[#7F1D1D] line-clamp-1">{it.name}</div>
                        <div className="text-xs text-[#64748B]">x{it.quantity} · ₹{it.line_total}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between items-center pt-3 border-t border-[#F1F5F9]">
                  <div className="text-sm">Total: <span className="font-numbers font-bold text-lg text-[#7F1D1D]">₹{o.total}</span></div>
                  {lastEvent?.note && (
                    <div className="text-xs text-[#64748B] italic line-clamp-1 max-w-[50%] text-right">
                      &ldquo;{lastEvent.note}&rdquo;
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
