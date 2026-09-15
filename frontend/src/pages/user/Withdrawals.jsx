import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Withdrawals() {
  const { user, refresh } = useAuth();
  const [list, setList] = useState([]);
  const [method, setMethod] = useState("upi");
  const [form, setForm] = useState({ amount: 100, upi_id: "", bank_name: "", account_number: "", ifsc: "", account_holder: "" });
  const [busy, setBusy] = useState(false);

  const fetchList = () => api.get("/withdrawals").then(({ data }) => setList(data));
  useEffect(() => { fetchList(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (user.kyc_status !== "approved") {
      toast.error("KYC must be approved before withdrawals.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/withdrawals/request", { ...form, method });
      toast.success("Withdrawal request submitted!");
      await refresh();
      await fetchList();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6" data-testid="withdrawals-page">
      <h1 className="font-display text-3xl font-bold">Withdrawals</h1>

      <div className="card-soft p-6">
        <h3 className="font-display font-bold text-lg mb-4">Request New Withdrawal</h3>
        {user?.kyc_status !== "approved" && (
          <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#7F1D1D] rounded-xl p-3 text-sm mb-4">
            ⚠️ KYC must be approved to withdraw. <a href="/kyc" className="font-semibold underline">Complete KYC</a>
          </div>
        )}
        {(user?.direct_referrals_count || 0) < 3 && (
          <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#7F1D1D] rounded-xl p-3 text-sm mb-4" data-testid="referral-rule-warning">
            🚀 You need at least <b>3 direct referrals</b> to start earning withdrawals. You have <b>{user?.direct_referrals_count || 0}/3</b>. <a href="/referral" className="font-semibold underline">Share your link</a>
          </div>
        )}
        <div className="mb-4">
          <div className="text-sm font-semibold mb-2">Method</div>
          <div className="flex gap-2">
            <button onClick={() => setMethod("upi")} className={`px-4 py-2 rounded-full text-sm font-semibold ${method === "upi" ? "bg-[#DC2626] text-[#7F1D1D]" : "bg-[#F1F5F9]"}`} data-testid="wd-method-upi">UPI</button>
            <button onClick={() => setMethod("bank")} className={`px-4 py-2 rounded-full text-sm font-semibold ${method === "bank" ? "bg-[#DC2626] text-[#7F1D1D]" : "bg-[#F1F5F9]"}`} data-testid="wd-method-bank">Bank</button>
          </div>
        </div>
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
          <input className="input-soft" type="number" placeholder="Amount (min ₹100)" value={form.amount} onChange={(e) => setForm({...form, amount: +e.target.value})} required data-testid="wd-amount"/>
          {method === "upi" ? (
            <input className="input-soft" placeholder="UPI ID (e.g. user@paytm)" value={form.upi_id} onChange={(e) => setForm({...form, upi_id: e.target.value})} required data-testid="wd-upi"/>
          ) : (
            <>
              <input className="input-soft" placeholder="Account Holder" value={form.account_holder} onChange={(e) => setForm({...form, account_holder: e.target.value})} required data-testid="wd-holder"/>
              <input className="input-soft" placeholder="Bank Name" value={form.bank_name} onChange={(e) => setForm({...form, bank_name: e.target.value})} required data-testid="wd-bank"/>
              <input className="input-soft" placeholder="Account Number" value={form.account_number} onChange={(e) => setForm({...form, account_number: e.target.value})} required data-testid="wd-acno"/>
              <input className="input-soft" placeholder="IFSC" value={form.ifsc} onChange={(e) => setForm({...form, ifsc: e.target.value})} required data-testid="wd-ifsc"/>
            </>
          )}
          <button disabled={busy} type="submit" className="btn-primary sm:col-span-2 justify-center" data-testid="wd-submit">{busy ? "Submitting…" : "Submit Request"}</button>
        </form>
      </div>

      <div className="card-soft p-6">
        <h3 className="font-display font-bold text-lg mb-4">My Withdrawals</h3>
        {list.length === 0 ? (
          <div className="text-sm text-[#64748B]">No withdrawals yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-[#64748B]">
                <tr><th className="py-2">Code</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {list.map((w) => (
                  <tr key={w.id} className="border-t border-[#F1F5F9]">
                    <td className="py-3 font-numbers font-semibold">{w.withdrawal_code}</td>
                    <td className="py-3 font-numbers">₹{w.amount}</td>
                    <td className="py-3 capitalize">{w.method}</td>
                    <td className="py-3"><span className={`badge-pill capitalize ${w.status === "approved" || w.status === "paid" ? "bg-[#FEE2E2] text-[#991B1B]" : w.status === "rejected" ? "bg-red-100 text-red-700" : "bg-[#FEF2F2] text-[#7F1D1D]"}`}>{w.status}</span></td>
                    <td className="py-3 text-xs text-[#64748B]">{new Date(w.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
