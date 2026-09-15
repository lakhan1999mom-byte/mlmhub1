import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import ImageSizeGuide from "@/components/ImageSizeGuide";

const blank = { name: "", logo_url: "", link: "", sort_order: 0, is_active: true };

export default function AdminBrands() {
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/brands").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const upload = async (file) => {
    const fd = new FormData(); fd.append("file", file);
    const { data } = await api.post("/cloudinary/upload?folder=brands", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setEdit((e) => ({ ...e, logo_url: data.url }));
    toast.success("Logo uploaded");
  };

  const save = async () => {
    if (!edit.name || !edit.logo_url) {
      toast.error("Name and logo are required");
      return;
    }
    setBusy(true);
    try {
      if (edit.id) await api.put(`/admin/brands/${edit.id}`, edit);
      else await api.post("/admin/brands", edit);
      toast.success("Saved");
      setEdit(null);
      load();
    } catch (err) {
      toast.error("Failed to save");
    } finally { setBusy(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this brand logo?")) return;
    await api.delete(`/admin/brands/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-6" data-testid="admin-brands-page">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="font-display text-3xl font-bold text-[#7F1D1D]">Partner Brand Logos</h1>
        <button onClick={() => setEdit({ ...blank })} className="btn-primary" data-testid="add-brand-btn">
          <Plus className="w-4 h-4"/> Add Brand
        </button>
      </div>

      <ImageSizeGuide preset="brand_logo"/>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((b) => (
          <div key={b.id} className="card-soft p-5 space-y-3" data-testid={`brand-${b.id}`}>
            <div className="bg-white h-24 rounded-xl border border-[#E2E8F0] flex items-center justify-center p-3">
              <img src={b.logo_url} alt={b.name} className="max-h-full max-w-full object-contain"/>
            </div>
            <div>
              <div className="font-semibold text-[#7F1D1D]">{b.name}</div>
              <div className="text-xs text-[#64748B]">Order: {b.sort_order} · {b.is_active ? "Active" : "Hidden"}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEdit({ ...b })} className="btn-outline text-xs flex-1 justify-center" data-testid={`edit-brand-${b.id}`}>
                <Pencil className="w-3 h-3"/> Edit
              </button>
              <button onClick={() => del(b.id)} className="text-xs bg-red-50 text-red-600 rounded-full px-3 py-2" data-testid={`del-brand-${b.id}`}>
                <Trash2 className="w-3 h-3"/>
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-center py-12 text-[#64748B]">No brand logos yet. Click "Add Brand" to upload the first one.</div>
        )}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-3" data-testid="brand-edit-modal">
            <h3 className="font-display font-bold text-xl">{edit.id ? "Edit" : "Add"} Brand Logo</h3>
            <ImageSizeGuide preset="brand_logo"/>
            <input
              className="input-soft"
              placeholder="Brand name (e.g. Tata, Amul)"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              data-testid="brand-name-input"
            />
            <div>
              <div className="text-sm font-semibold mb-2 text-[#7F1D1D]">Logo Image</div>
              {edit.logo_url ? (
                <div className="relative w-40 h-24 border border-[#E2E8F0] rounded-xl overflow-hidden bg-white p-2">
                  <img src={edit.logo_url} alt="" className="w-full h-full object-contain"/>
                  <button onClick={() => setEdit({ ...edit, logo_url: "" })} className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-bl-md px-1.5">×</button>
                </div>
              ) : (
                <label className="w-40 h-24 border-2 border-dashed border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#DC2626]">
                  <Upload className="w-4 h-4 text-[#B91C1C]"/>
                  <span className="text-xs text-[#B91C1C] mt-1">Upload logo</span>
                  <input type="file" hidden accept="image/*" onChange={(e) => e.target.files[0] && upload(e.target.files[0])} data-testid="brand-logo-upload"/>
                </label>
              )}
            </div>
            <input
              className="input-soft"
              type="number"
              placeholder="Sort order (lower = first)"
              value={edit.sort_order}
              onChange={(e) => setEdit({ ...edit, sort_order: +e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit.is_active !== false}
                onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })}
              /> Show on landing page
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEdit(null)} className="btn-outline flex-1 justify-center">Cancel</button>
              <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center" data-testid="save-brand-btn">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
