import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Users, ShoppingBag, Wallet, TrendingUp, FileCheck, MessageSquare, Send } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then(({ data }) => setStats(data)); }, []);
  if (!stats) return <div className="p-8 text-center">Loading…</div>;

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <h1 className="font-display text-3xl font-bold text-[#064E3B]">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={Users} label="Total Users" value={stats.total_users} accent="#84CC16"/>
        <Kpi icon={TrendingUp} label="Revenue" value={`₹${(stats.total_revenue || 0).toLocaleString()}`} accent="#FBBF24"/>
        <Kpi icon={ShoppingBag} label="Orders" value={stats.total_orders} accent="#064E3B"/>
        <Kpi icon={Wallet} label="Commissions Paid" value={`₹${(stats.total_commissions || 0).toLocaleString()}`} accent="#65A30D"/>
        <Kpi icon={Send} label="Pending Withdrawals" value={stats.pending_withdrawals} accent="#F97316"/>
        <Kpi icon={FileCheck} label="Pending KYC" value={stats.pending_kyc} accent="#FBBF24"/>
        <Kpi icon={MessageSquare} label="Open Tickets" value={stats.open_tickets} accent="#EF4444"/>
        <Kpi icon={Users} label="Active Users" value={stats.active_users} accent="#064E3B"/>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-soft p-6">
          <h3 className="font-display font-bold text-lg mb-4">Last 7 Days Revenue</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats.daily_revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0"/>
              <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickFormatter={(v) => v.slice(5)}/>
              <YAxis stroke="#64748B" fontSize={10}/>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }}/>
              <Line type="monotone" dataKey="revenue" stroke="#84CC16" strokeWidth={3} dot={{ fill: "#84CC16", r: 4 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card-soft p-6">
          <h3 className="font-display font-bold text-lg mb-4">Users by Stage</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.stage_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0"/>
              <XAxis dataKey="stage" stroke="#64748B" fontSize={10}/>
              <YAxis stroke="#64748B" fontSize={10}/>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }}/>
              <Bar dataKey="users" fill="#FBBF24" radius={[8, 8, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }) {
  return (
    <div className="card-soft p-5" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${accent}20` }}>
        <Icon className="w-5 h-5" style={{ color: accent }}/>
      </div>
      <div className="text-xs uppercase tracking-widest text-[#64748B]">{label}</div>
      <div className="font-numbers text-2xl font-bold text-[#064E3B] mt-1">{value}</div>
    </div>
  );
}
