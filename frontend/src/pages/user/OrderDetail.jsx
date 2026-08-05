import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Truck, CheckCircle2, Clock, ArrowLeft, MapPin, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const TRACKING_STEPS = [
  { key: "placed", label: "Order Placed", icon: Package },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "packed", label: "Packed", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => setOrder(data))
      .catch(() => toast.error("Order not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-12 text-center text-[#64748B]">Loading…</div>;
  if (!order) return (
    <div className="p-12 text-center">
      <div className="text-6xl mb-3">🔍</div>
      <div className="font-display font-bold text-lg mb-2">Order not found</div>
      <Link to="/orders" className="text-[#65A30D] font-semibold">← Back to orders</Link>
    </div>
  );

  const currentStepIdx = TRACKING_STEPS.findIndex((s) => s.key === order.status);
  const history = order.tracking_history || [];

  const copyTracking = () => {
    if (order.tracking_no) {
      navigator.clipboard.writeText(order.tracking_no);
      toast.success("Tracking number copied");
    }
  };

  return (
    <div className="space-y-6" data-testid="order-detail-page">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-[#64748B] hover:text-[#065F46]" data-testid="back-to-orders">
        <ArrowLeft className="w-4 h-4"/> Back to orders
      </Link>

      {/* Header */}
      <div className="card-soft p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-black text-[#064E3B]">{order.order_code}</h1>
            <div className="text-sm text-[#64748B] flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3"/> Placed on {new Date(order.created_at).toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#94A3B8] uppercase font-bold">Total</div>
            <div className="font-numbers text-3xl font-black text-[#064E3B]">₹{order.total.toFixed(0)}</div>
            <span className={`badge-pill mt-1 capitalize ${order.payment_status === "paid" ? "bg-[#ECFCCB] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>Payment: {order.payment_status}</span>
          </div>
        </div>
      </div>

      {/* Tracking Progress Steps */}
      <div className="card-soft p-6" data-testid="tracking-steps">
        <div className="flex items-center gap-2 mb-6">
          <Truck className="w-5 h-5 text-[#84CC16]"/>
          <h2 className="font-display font-bold text-lg text-[#064E3B]">Shipment Status</h2>
        </div>

        {order.tracking_no && (
          <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#064E3B] to-[#065F46] text-white p-4" data-testid="tracking-number-card">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs uppercase tracking-widest text-[#84CC16] font-bold mb-1">
                  {order.courier_name || "Courier"} tracking
                </div>
                <div className="font-mono font-black text-lg">{order.tracking_no}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={copyTracking} className="px-3 py-1.5 bg-white/10 rounded-lg text-xs hover:bg-white/20 inline-flex items-center gap-1" data-testid="copy-tracking-btn">
                  <Copy className="w-3 h-3"/> Copy
                </button>
                {order.tracking_url && (
                  <a href={order.tracking_url} target="_blank" rel="noreferrer noopener" className="px-3 py-1.5 bg-[#84CC16] text-[#064E3B] rounded-lg text-xs font-bold hover:bg-[#65A30D] inline-flex items-center gap-1" data-testid="track-online-btn">
                    Track online <ExternalLink className="w-3 h-3"/>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step pills */}
        <div className="relative">
          <div className="hidden md:flex items-center justify-between gap-2 relative">
            <div className="absolute left-0 right-0 top-6 h-1 bg-[#E2E8F0] rounded-full"/>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: currentStepIdx < 0 ? "0%" : `${(currentStepIdx / (TRACKING_STEPS.length - 1)) * 100}%` }}
              transition={{ duration: 0.6 }}
              className="absolute left-0 top-6 h-1 bg-gradient-to-r from-[#84CC16] to-[#65A30D] rounded-full"
            />
            {TRACKING_STEPS.map((step, idx) => {
              const done = idx <= currentStepIdx;
              const Icon = step.icon;
              return (
                <div key={step.key} className="relative flex flex-col items-center flex-1 z-10">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${done ? "bg-[#84CC16] border-[#65A30D] text-[#064E3B]" : "bg-white border-[#E2E8F0] text-[#94A3B8]"}`}>
                    <Icon className="w-5 h-5"/>
                  </div>
                  <div className={`text-[10px] font-semibold mt-2 text-center leading-tight ${done ? "text-[#064E3B]" : "text-[#94A3B8]"}`}>
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Mobile: vertical list */}
          <div className="md:hidden space-y-2">
            {TRACKING_STEPS.map((step, idx) => {
              const done = idx <= currentStepIdx;
              const Icon = step.icon;
              return (
                <div key={step.key} className={`flex items-center gap-3 p-2 rounded-xl ${done ? "bg-[#ECFCCB]" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${done ? "bg-[#84CC16] text-[#064E3B]" : "bg-[#E2E8F0] text-[#94A3B8]"}`}>
                    <Icon className="w-4 h-4"/>
                  </div>
                  <div className={`text-sm font-semibold ${done ? "text-[#064E3B]" : "text-[#94A3B8]"}`}>{step.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detailed history */}
      {history.length > 0 && (
        <div className="card-soft p-6" data-testid="tracking-history">
          <h3 className="font-display font-bold text-lg text-[#064E3B] mb-4">Update Timeline</h3>
          <div className="space-y-4 relative">
            <div className="absolute left-[10px] top-3 bottom-3 w-0.5 bg-[#E2E8F0]"/>
            {history.slice().reverse().map((e, i) => (
              <div key={i} className="flex gap-4 relative" data-testid={`history-event-${i}`}>
                <div className="w-5 h-5 rounded-full bg-[#84CC16] border-2 border-white ring-2 ring-[#84CC16]/30 flex-shrink-0 z-10 mt-1"/>
                <div className="flex-1">
                  <div className="font-semibold text-[#064E3B] text-sm">{e.label || e.status}</div>
                  {e.note && <div className="text-sm text-[#334155] mt-0.5">{e.note}</div>}
                  <div className="text-xs text-[#94A3B8] font-numbers mt-1">
                    {new Date(e.at).toLocaleString()}{e.by ? ` · ${e.by}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="card-soft p-6">
        <h3 className="font-display font-bold text-lg text-[#064E3B] mb-4">Items in this order</h3>
        <div className="space-y-2">
          {order.items.map((it) => (
            <div key={it.product_id} className="flex items-center gap-3 p-3 bg-[#FAFAF9] rounded-xl">
              {it.image && <img src={it.image} alt="" className="w-14 h-14 rounded-xl object-cover"/>}
              <div className="flex-1">
                <div className="font-semibold text-[#064E3B]">{it.name}</div>
                <div className="text-xs text-[#64748B]">Qty: {it.quantity} · ₹{it.price} each</div>
              </div>
              <div className="font-numbers font-bold text-[#064E3B]">₹{it.line_total}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Shipping address */}
      {order.address && (
        <div className="card-soft p-6">
          <h3 className="font-display font-bold text-lg text-[#064E3B] mb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#65A30D]"/> Shipping to
          </h3>
          <div className="text-sm text-[#334155] space-y-0.5">
            <div className="font-semibold">{order.address.full_name || order.address.name}</div>
            <div>{order.address.line1}</div>
            <div>{order.address.city}, {order.address.state} — {order.address.pincode}</div>
            <div className="text-[#64748B]">📞 {order.address.phone}</div>
          </div>
        </div>
      )}
    </div>
  );
}
