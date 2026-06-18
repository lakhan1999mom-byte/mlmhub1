import { useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Upload } from "lucide-react";

export default function Profile() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [avatar, setAvatar] = useState(user?.avatar_url || "");
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const uploadAvatar = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post(`/cloudinary/upload?folder=users/${user.id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    setAvatar(data.url);
    toast.success("Avatar uploaded");
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/users/profile", { name, avatar_url: avatar });
      await refresh();
      toast.success("Profile updated");
    } catch (e) { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6" data-testid="profile-page">
      <h1 className="font-display text-3xl font-bold">My Profile</h1>
      <div className="card-soft p-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#84CC16] to-[#65A30D] flex items-center justify-center overflow-hidden">
            {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover"/> : <span className="text-3xl font-bold text-[#064E3B]">{user.name?.[0]}</span>}
          </div>
          <label className="btn-outline cursor-pointer text-sm">
            <Upload className="w-4 h-4"/> Upload Avatar
            <input type="file" hidden accept="image/*" onChange={(e) => e.target.files[0] && uploadAvatar(e.target.files[0])} data-testid="avatar-upload"/>
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="User Code" value={user.user_code}/>
          <Field label="Sponsor ID" value={user.sponsor_id || "—"}/>
          <Field label="Referral Code" value={user.referral_code}/>
          <Field label="Current Stage" value={`Stage ${user.current_stage}`}/>
          <div>
            <label className="text-sm font-semibold">Name</label>
            <input className="input-soft mt-1" value={name} onChange={(e) => setName(e.target.value)} data-testid="profile-name"/>
          </div>
          <Field label="Email" value={user.email}/>
          <Field label="Phone" value={user.phone}/>
          <Field label="KYC Status" value={user.kyc_status}/>
        </div>
        <button onClick={save} disabled={busy} className="btn-primary mt-6" data-testid="profile-save-btn">{busy ? "Saving…" : "Save Changes"}</button>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <div className="input-soft mt-1 bg-[#F1F5F9] text-[#334155] capitalize">{value}</div>
    </div>
  );
}
