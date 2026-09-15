import { useEffect, useState } from "react";
import api from "@/lib/api";
import { TrendingUp, DollarSign, Package, CreditCard, Wallet } from "lucide-react";

export default function AdminAccounts() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/accounts").then(({ data }) => setD(data)); }, []);
  if (!d) return <div className="p-8 text-center">Loading…</div>;

  return (
    <div className="space-y-6" data-testid="admin-accounts-page">
      <h1 className="font-display text-3xl font-bold">Accounts & Sales</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={TrendingUp} label="Total Sales" value={`₹${d.total_sales.toLocaleString('en-IN')}`} accent="#DC2626"/>
        <Kpi icon={DollarSign} label="Today's Sales" value={`₹${d.today_sales.toLocaleString('en-IN')}`} accent="#DC2626"/>
        <Kpi icon={TrendingUp} label="This Month" value={`₹${d.month_sales.toLocaleString('en-IN')}`} accent="#991B1B"/>
        <Kpi icon={CreditCard} label="Pending Payments" value={d.pending_payments} accent="#B91C1C"/>
        <Kpi icon={CreditCard} label="Completed Payments" value={d.completed_payments} accent="#B91C1C"/>
        <Kpi icon={Wallet} label="Commissions Credited" value={`₹${d.total_commissions_credited.toLocaleString('en-IN')}`} accent="#DC2626"/>
        <Kpi icon={Wallet} label="Wallet Liability" value={`₹${d.outstanding_wallet_liability.toLocaleString('en-IN')}`} accent="#EF4444"/>
        <Kpi icon={Package} label="Withdrawn" value={`₹${d.withdrawn_total.toLocaleString('en-IN')}`} accent="#0891B2"/>
      </div>

      <div className="card-soft p-6">
        <h3 className="font-display font-bold text-lg mb-4">Orders by Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(d.orders_by_status).map(([status, count]) => (
            <div key={status} className="p-4 rounded-xl bg-[#FAFAF9] border border-[#E2E8F0] text-center" data-testid={`orders-${status}`}>
              <div className="text-xs uppercase tracking-widest text-[#64748B] capitalize">{status}</div>
              <div className="font-numbers text-2xl font-bold text-[#7F1D1D] mt-1">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }) {
  return (
    <div className="card-soft p-5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${accent}20` }}>
        <Icon className="w-5 h-5" style={{ color: accent }}/>
      </div>
      <div className="text-xs uppercase tracking-widest text-[#64748B]">{label}</div>
      <div className="font-numbers text-xl font-bold text-[#7F1D1D] mt-1">{value}</div>
    </div>
  );
}
