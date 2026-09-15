import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Wallet() {
  const { user } = useAuth();
  const [txns, setTxns] = useState([]);
  useEffect(() => { api.get("/wallet/transactions").then(({ data }) => setTxns(data)); }, []);
  if (!user) return null;
  return (
    <div className="space-y-6" data-testid="wallet-page">
      <h1 className="font-display text-3xl font-bold">My Wallets</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <WalletBox label="Total Balance" value={user.wallet_balance} primary/>
        <WalletBox label="Commission" value={user.commission_wallet}/>
        <WalletBox label="Cashback" value={user.cashback_wallet}/>
        <WalletBox label="Reward" value={user.reward_wallet}/>
      </div>
      <Link to="/withdrawals" className="btn-primary inline-flex" data-testid="wallet-withdraw-link"><ArrowUpRight className="w-4 h-4"/> Request Withdrawal</Link>

      <div className="card-soft p-6">
        <h3 className="font-display font-bold text-lg mb-4">Transaction History</h3>
        {txns.length === 0 ? (
          <div className="text-sm text-[#64748B]">No transactions yet</div>
        ) : (
          <div className="space-y-2">
            {txns.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 border-b border-[#F1F5F9] last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${t.type === "credit" ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-red-100 text-[#EF4444]"}`}>
                    {t.type === "credit" ? <ArrowDownRight className="w-4 h-4"/> : <ArrowUpRight className="w-4 h-4"/>}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[#7F1D1D] capitalize">{t.category}</div>
                    <div className="text-xs text-[#64748B]">{t.description}</div>
                    <div className="text-xs text-[#94A3B8] font-numbers">{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className={`font-numbers font-bold ${t.type === "credit" ? "text-[#B91C1C]" : "text-[#EF4444]"}`}>
                  {t.type === "credit" ? "+" : "−"}₹{t.amount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WalletBox({ label, value, primary }) {
  return (
    <div className={`rounded-2xl p-5 ${primary ? "bg-gradient-to-br from-[#DC2626] to-[#B91C1C] text-[#7F1D1D]" : "card-soft"}`}>
      <WalletIcon className="w-5 h-5 mb-3"/>
      <div className="text-xs uppercase tracking-widest opacity-80">{label}</div>
      <div className="font-numbers text-2xl font-bold mt-1">₹{(value || 0).toLocaleString()}</div>
    </div>
  );
}
