import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Plus, Trash2, Upload, Pencil } from "lucide-react";
import ImageSizeGuide from "@/components/ImageSizeGuide";

const blank = { title: "", subtitle: "", image_url: "", link: "/", cta_label: "Learn More", location: "landing_top", is_active: true, sort_order: 1 };

export default function AdminSliders() {
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/sliders").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const uploadImg = async (file) => {
    const fd = new FormData(); fd.append("file", file);
    const { data } = await api.post("/cloudinary/upload?folder=banners/sliders", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setEdit((s) => ({ ...s, image_url: data.url }));
    toast.success("Uploaded");
  };

  const save = async () => {
    setBusy(true);
    try {
      if (edit.id) await api.put(`/admin/sliders/${edit.id}`, edit);
      else await api.post("/admin/sliders", edit);
      toast.success("Saved");
      setEdit(null);
      load();
    } catch { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this slider?")) return;
    await api.delete(`/admin/sliders/${id}`);
    toast.success("Deleted");
    load();
  };

  const groupedByLocation = items.reduce((acc, s) => {
    (acc[s.location] = acc[s.location] || []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="admin-sliders-page">
      <div className="flex justify-between items-center">
        <h1 className="font-display text-3xl font-bold">Sliders</h1>
        <button onClick={() => setEdit({ ...blank })} className="btn-primary" data-testid="add-slider-btn"><Plus className="w-4 h-4"/>Add Slider</button>
      </div>

      {Object.entries(groupedByLocation).map(([loc, sliders]) => (
        <div key={loc} className="card-soft p-6">
          <h3 className="font-display font-bold mb-4 capitalize">{loc.replace("_", " ")} <span className="text-xs text-[#64748B] font-numbers">({sliders.length})</span></h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sliders.map((s) => (
              <div key={s.id} className="border border-[#E2E8F0] rounded-xl overflow-hidden" data-testid={`slider-${s.id}`}>
                <div className="aspect-video bg-[#F1F5F9]">
                  {s.image_url && <img src={s.image_url} alt={s.title} className="w-full h-full object-cover"/>}
                </div>
                <div className="p-3">
                  <div className="font-semibold text-sm text-[#7F1D1D] truncate">{s.title}</div>
                  <div className="text-xs text-[#64748B] truncate">{s.subtitle}</div>
                  <div className="text-xs text-[#B91C1C] font-numbers mt-1">Order: {s.sort_order} · {s.is_active ? "Active" : "Inactive"}</div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setEdit({ ...s })} className="text-xs bg-[#FEE2E2] text-[#7F1D1D] rounded-full px-3 py-1 font-semibold flex items-center gap-1"><Pencil className="w-3 h-3"/>Edit</button>
                    <button onClick={() => del(s.id)} className="text-xs bg-red-50 text-red-600 rounded-full px-3 py-1 font-semibold flex items-center gap-1" data-testid={`del-slider-${s.id}`}><Trash2 className="w-3 h-3"/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {edit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-3">
            <h3 className="font-display font-bold text-xl">{edit.id ? "Edit" : "Add"} Slider</h3>
            <input className="input-soft" placeholder="Title" value={edit.title} onChange={(e) => setEdit({...edit, title: e.target.value})} data-testid="slider-title"/>
            <input className="input-soft" placeholder="Subtitle" value={edit.subtitle} onChange={(e) => setEdit({...edit, subtitle: e.target.value})}/>
            <input className="input-soft" placeholder="Link (e.g. /products)" value={edit.link} onChange={(e) => setEdit({...edit, link: e.target.value})}/>
            <input className="input-soft" placeholder="CTA Label" value={edit.cta_label} onChange={(e) => setEdit({...edit, cta_label: e.target.value})}/>
            <select className="input-soft" value={edit.location} onChange={(e) => setEdit({...edit, location: e.target.value})}>
              <option value="landing_top">Landing — Top</option>
              <option value="landing_mid">Landing — Middle</option>
              <option value="user_dashboard">User Dashboard</option>
            </select>
            <input type="number" className="input-soft" placeholder="Sort Order" value={edit.sort_order} onChange={(e) => setEdit({...edit, sort_order: +e.target.value})}/>
            <div>
              <div className="text-sm font-semibold mb-2">Image</div>
              <ImageSizeGuide preset="slider"/>
              {edit.image_url ? (
                <div className="relative mt-2">
                  <img src={edit.image_url} alt="" className="rounded-lg max-h-40 object-cover w-full"/>
                  <button onClick={() => setEdit({...edit, image_url: ""})} className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6">×</button>
                </div>
              ) : (
                <label className="block border-2 border-dashed border-[#E2E8F0] rounded-lg p-6 text-center cursor-pointer hover:border-[#DC2626]">
                  <Upload className="w-5 h-5 mx-auto text-[#B91C1C] mb-2"/>
                  <div className="text-sm">Upload Image</div>
                  <input type="file" hidden accept="image/*" onChange={(e) => e.target.files[0] && uploadImg(e.target.files[0])}/>
                </label>
              )}
              <input className="input-soft mt-2" placeholder="OR paste image URL" value={edit.image_url} onChange={(e) => setEdit({...edit, image_url: e.target.value})}/>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!edit.is_active} onChange={(e) => setEdit({...edit, is_active: e.target.checked})}/> Active
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEdit(null)} className="btn-outline flex-1 justify-center">Cancel</button>
              <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center" data-testid="save-slider">{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
