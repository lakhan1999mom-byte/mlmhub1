import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Upload, CheckCircle2 } from "lucide-react";

export default function KycPage() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState({ aadhaar_number: "", pan_number: "", aadhaar_doc: "", pan_doc: "", selfie: "" });
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState(null);

  useEffect(() => { api.get("/kyc/me").then(({ data }) => { setExisting(data); if (data?.id) setData({...data}); }); }, []);

  const upload = async (file, field) => {
    const fd = new FormData();
    fd.append("file", file);
    const { data: r } = await api.post(`/cloudinary/upload?folder=kyc/${user.id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    setData((d) => ({ ...d, [field]: r.url }));
    toast.success("Uploaded");
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/kyc/submit", data);
      toast.success("KYC submitted — awaiting admin review");
      await refresh();
    } catch (err) { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6" data-testid="kyc-page">
      <h1 className="font-display text-3xl font-bold">KYC Verification</h1>
      <div className="card-soft p-6">
        <div className="text-sm mb-4">Current Status: <span className={`badge-pill capitalize ${user.kyc_status === "approved" ? "bg-[#ECFCCB] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>{user.kyc_status}</span></div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold">Aadhaar Number</label>
            <input className="input-soft mt-1" value={data.aadhaar_number || ""} onChange={(e) => setData({...data, aadhaar_number: e.target.value})} data-testid="kyc-aadhaar-no"/>
          </div>
          <div>
            <label className="text-sm font-semibold">PAN Number</label>
            <input className="input-soft mt-1" value={data.pan_number || ""} onChange={(e) => setData({...data, pan_number: e.target.value})} data-testid="kyc-pan-no"/>
          </div>
          <UploadField label="Aadhaar Document" url={data.aadhaar_doc} onChange={(f) => upload(f, "aadhaar_doc")} testid="kyc-aadhaar-doc"/>
          <UploadField label="PAN Document" url={data.pan_doc} onChange={(f) => upload(f, "pan_doc")} testid="kyc-pan-doc"/>
          <UploadField label="Selfie" url={data.selfie} onChange={(f) => upload(f, "selfie")} testid="kyc-selfie"/>
        </div>
        <button onClick={submit} disabled={busy} className="btn-primary mt-6" data-testid="kyc-submit-btn">{busy ? "Submitting…" : "Submit KYC"}</button>
      </div>
    </div>
  );
}

function UploadField({ label, url, onChange, testid }) {
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <div className="mt-1 border-2 border-dashed border-[#E2E8F0] rounded-xl p-4 text-center hover:border-[#84CC16] transition-colors">
        {url ? (
          <div className="space-y-2">
            <img src={url} alt="" className="w-32 h-32 object-cover rounded-lg mx-auto"/>
            <div className="text-xs text-[#65A30D] flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3"/>Uploaded</div>
            <label className="text-xs cursor-pointer text-[#65A30D] underline">
              Replace
              <input type="file" hidden accept="image/*,.pdf" onChange={(e) => e.target.files[0] && onChange(e.target.files[0])} data-testid={testid}/>
            </label>
          </div>
        ) : (
          <label className="cursor-pointer block">
            <Upload className="w-6 h-6 mx-auto text-[#65A30D] mb-2"/>
            <div className="text-sm text-[#334155]">Click to upload</div>
            <input type="file" hidden accept="image/*,.pdf" onChange={(e) => e.target.files[0] && onChange(e.target.files[0])} data-testid={testid}/>
          </label>
        )}
      </div>
    </div>
  );
}
