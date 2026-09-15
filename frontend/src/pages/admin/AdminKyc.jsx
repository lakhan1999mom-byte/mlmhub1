import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function AdminKyc() {
  const [items, setItems] = useState([]);
  const load = () => api.get("/admin/kyc").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const review = async (k, status) => {
    const note = window.prompt("Note (optional):", "");
    await api.put(`/admin/kyc/${k.id}`, { status, admin_note: note });
    toast.success("KYC " + status);
    load();
  };

  return (
    <div className="space-y-6" data-testid="admin-kyc-page">
      <h1 className="font-display text-3xl font-bold">KYC Verification</h1>
      {items.map((k) => (
        <div key={k.id} className="card-soft p-6" data-testid={`kyc-row-${k.user_code}`}>
          <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
            <div>
              <div className="font-display font-bold">{k.user_name || k.user_code}</div>
              <div className="text-xs font-numbers text-[#64748B]">{k.user_code} · Submitted: {new Date(k.submitted_at).toLocaleDateString()}</div>
            </div>
            <span className={`badge-pill capitalize ${k.status === "approved" ? "bg-[#FEE2E2] text-[#991B1B]" : k.status === "rejected" ? "bg-red-100 text-red-700" : "bg-[#FEF2F2] text-[#7F1D1D]"}`}>{k.status}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Doc title="Aadhaar" url={k.aadhaar_doc} no={k.aadhaar_number}/>
            <Doc title="PAN" url={k.pan_doc} no={k.pan_number}/>
            <Doc title="Selfie" url={k.selfie}/>
          </div>
          {k.status === "pending" && (
            <div className="flex gap-2">
              <button onClick={() => review(k, "approved")} className="btn-primary text-sm" data-testid={`kyc-approve-${k.user_code}`}>Approve</button>
              <button onClick={() => review(k, "rejected")} className="text-sm bg-red-100 text-red-700 rounded-full px-4 py-2 font-semibold" data-testid={`kyc-reject-${k.user_code}`}>Reject</button>
            </div>
          )}
        </div>
      ))}
      {items.length === 0 && <div className="card-soft p-12 text-center text-[#64748B]">No KYC submissions</div>}
    </div>
  );
}

function Doc({ title, url, no }) {
  return (
    <div className="border border-[#E2E8F0] rounded-xl p-2 text-center">
      <div className="text-xs font-semibold mb-1">{title}</div>
      {url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="w-full h-24 object-cover rounded-lg"/></a> : <div className="text-xs text-[#94A3B8] py-6">Not uploaded</div>}
      {no && <div className="text-xs font-numbers mt-1">{no}</div>}
    </div>
  );
}
