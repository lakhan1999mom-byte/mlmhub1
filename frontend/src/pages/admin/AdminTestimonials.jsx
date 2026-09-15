import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Plus, Pencil, Trash2, Upload, Star } from "lucide-react";
import ImageSizeGuide from "@/components/ImageSizeGuide";

const blank = { name: "", role: "", rating: 5, message: "", avatar: "", is_active: true };

export default function AdminTestimonials() {
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/testimonials").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const upload = async (file) => {
    const fd = new FormData(); fd.append("file", file);
    const { data } = await api.post("/cloudinary/upload?folder=testimonials", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setEdit((e) => ({ ...e, avatar: data.url }));
    toast.success("Photo uploaded");
  };

  const save = async () => {
    if (!edit.name || !edit.message) return toast.error("Name and message are required");
    setBusy(true);
    try {
      if (edit.id) await api.put(`/admin/testimonials/${edit.id}`, edit);
      else await api.post("/admin/testimonials", edit);
      toast.success("Saved");
      setEdit(null);
      load();
    } catch (err) { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this testimonial?")) return;
    await api.delete(`/admin/testimonials/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-6" data-testid="admin-testimonials-page">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#7F1D1D]">Testimonials</h1>
          <div className="text-sm text-[#64748B]">Total: {items.length} · Shown on landing page as auto-scrolling slider</div>
        </div>
        <button onClick={() => setEdit({ ...blank })} className="btn-primary" data-testid="add-testimonial-btn">
          <Plus className="w-4 h-4"/> Add Testimonial
        </button>
      </div>

      <ImageSizeGuide preset="avatar" extraNote="Testimonial photo shows next to name."/>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((t) => (
          <div key={t.id} className="card-soft p-5 space-y-3" data-testid={`testimonial-row-${t.id}`}>
            <div className="flex items-start gap-3">
              <img src={t.avatar || "https://i.pravatar.cc/100?img=1"} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0"/>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[#7F1D1D] truncate">{t.name}</div>
                <div className="text-xs text-[#B91C1C]">{t.role}</div>
                <div className="flex gap-0.5 mt-0.5">
                  {[...Array(t.rating || 5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-[#DC2626] text-[#DC2626]"/>)}
                </div>
              </div>
            </div>
            <p className="text-sm text-[#334155] line-clamp-3">"{t.message}"</p>
            <div className="flex gap-2">
              <button onClick={() => setEdit({ ...t })} className="btn-outline text-xs flex-1 justify-center" data-testid={`edit-testimonial-${t.id}`}>
                <Pencil className="w-3 h-3"/> Edit
              </button>
              <button onClick={() => del(t.id)} className="text-xs bg-red-50 text-red-600 rounded-full px-3 py-2" data-testid={`del-testimonial-${t.id}`}>
                <Trash2 className="w-3 h-3"/>
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-center py-12 text-[#64748B]">No testimonials yet.</div>
        )}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto" data-testid="testimonial-edit-modal">
            <h3 className="font-display font-bold text-xl">{edit.id ? "Edit" : "Add"} Testimonial</h3>
            <ImageSizeGuide preset="avatar"/>
            <input className="input-soft" placeholder="Member name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} data-testid="t-name-input"/>
            <input className="input-soft" placeholder="Role (e.g. Level 5 Member)" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} data-testid="t-role-input"/>
            <textarea className="input-soft min-h-[100px]" placeholder="Testimonial message" value={edit.message} onChange={(e) => setEdit({ ...edit, message: e.target.value })} data-testid="t-message-input"/>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-[#7F1D1D]">Rating:</label>
              <select className="input-soft w-24" value={edit.rating} onChange={(e) => setEdit({ ...edit, rating: +e.target.value })}>
                {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} ★</option>)}
              </select>
            </div>
            <div>
              <div className="text-sm font-semibold mb-2 text-[#7F1D1D]">Photo</div>
              {edit.avatar ? (
                <div className="relative w-20 h-20 rounded-full overflow-hidden">
                  <img src={edit.avatar} alt="" className="w-full h-full object-cover"/>
                  <button onClick={() => setEdit({ ...edit, avatar: "" })} className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5">×</button>
                </div>
              ) : (
                <label className="w-20 h-20 border-2 border-dashed border-[#E2E8F0] rounded-full flex flex-col items-center justify-center cursor-pointer hover:border-[#DC2626]">
                  <Upload className="w-4 h-4 text-[#B91C1C]"/>
                  <input type="file" hidden accept="image/*" onChange={(e) => e.target.files[0] && upload(e.target.files[0])} data-testid="t-avatar-upload"/>
                </label>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_active !== false} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })}/> Show on landing
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEdit(null)} className="btn-outline flex-1 justify-center">Cancel</button>
              <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center" data-testid="save-testimonial-btn">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
