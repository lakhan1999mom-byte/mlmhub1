import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";

const blank = {
  name: "", description: "", price: 0, mrp: 0, sku: "", category: "general", brand: "EverGro",
  gst_percent: 5, stock: 100, images: [], badges: [], is_hamper: false, hamper_tier: null, contents: [], is_active: true,
};

export default function AdminProducts() {
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/products").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const open = (p) => setEdit(p ? {...p} : {...blank});
  const close = () => setEdit(null);

  const uploadImg = async (file) => {
    const fd = new FormData(); fd.append("file", file);
    const { data } = await api.post("/cloudinary/upload?folder=products/general", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setEdit((e) => ({ ...e, images: [...(e.images || []), data.url] }));
    toast.success("Image uploaded");
  };

  const save = async () => {
    setBusy(true);
    try {
      if (edit.id) await api.put(`/admin/products/${edit.id}`, edit);
      else await api.post("/admin/products", edit);
      toast.success("Saved");
      close();
      load();
    } catch (e) { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    await api.delete(`/admin/products/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-6" data-testid="admin-products-page">
      <div className="flex justify-between">
        <h1 className="font-display text-3xl font-bold">Products</h1>
        <button onClick={() => open(null)} className="btn-primary" data-testid="add-product-btn"><Plus className="w-4 h-4"/>Add</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((p) => (
          <div key={p.id} className="card-soft overflow-hidden" data-testid={`admin-product-${p.id}`}>
            <img src={p.images?.[0]} alt="" className="aspect-video w-full object-cover"/>
            <div className="p-4">
              <div className="font-semibold text-[#064E3B] truncate">{p.name}</div>
              <div className="text-xs text-[#64748B]">{p.category}{p.is_hamper && ` · ${p.hamper_tier}`}</div>
              <div className="flex items-center justify-between mt-2">
                <div className="font-numbers font-bold">₹{p.price}</div>
                <div className="text-xs text-[#64748B]">Stock: {p.stock}</div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => open(p)} className="btn-outline text-xs flex-1 justify-center"><Pencil className="w-3 h-3"/>Edit</button>
                <button onClick={() => del(p.id)} className="text-xs bg-red-50 text-red-600 rounded-full px-3 py-2" data-testid={`del-${p.id}`}><Trash2 className="w-3 h-3"/></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-3" data-testid="product-edit-modal">
            <h3 className="font-display font-bold text-xl">{edit.id ? "Edit" : "Add"} Product</h3>
            <input className="input-soft" placeholder="Name" value={edit.name} onChange={(e) => setEdit({...edit, name: e.target.value})}/>
            <textarea className="input-soft min-h-[80px]" placeholder="Description" value={edit.description} onChange={(e) => setEdit({...edit, description: e.target.value})}/>
            <div className="grid grid-cols-2 gap-3">
              <input className="input-soft" type="number" placeholder="Price" value={edit.price} onChange={(e) => setEdit({...edit, price: +e.target.value})}/>
              <input className="input-soft" type="number" placeholder="MRP" value={edit.mrp} onChange={(e) => setEdit({...edit, mrp: +e.target.value})}/>
              <input className="input-soft" placeholder="Category" value={edit.category} onChange={(e) => setEdit({...edit, category: e.target.value})}/>
              <input className="input-soft" placeholder="Brand" value={edit.brand} onChange={(e) => setEdit({...edit, brand: e.target.value})}/>
              <input className="input-soft" type="number" placeholder="Stock" value={edit.stock} onChange={(e) => setEdit({...edit, stock: +e.target.value})}/>
              <input className="input-soft" type="number" placeholder="GST %" value={edit.gst_percent} onChange={(e) => setEdit({...edit, gst_percent: +e.target.value})}/>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_hamper} onChange={(e) => setEdit({...edit, is_hamper: e.target.checked})}/> This is a Hamper
            </label>
            {edit.is_hamper && (
              <select className="input-soft" value={edit.hamper_tier || ""} onChange={(e) => setEdit({...edit, hamper_tier: e.target.value})}>
                <option value="">Select tier</option>
                <option>Bronze</option><option>Silver</option><option>Gold</option><option>Platinum</option>
              </select>
            )}
            <div>
              <div className="text-sm font-semibold mb-2">Badges (comma-separated)</div>
              <input className="input-soft" value={(edit.badges || []).join(",")} onChange={(e) => setEdit({...edit, badges: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)})}/>
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">Images</div>
              <div className="flex flex-wrap gap-2">
                {(edit.images || []).map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-[#FAFAF9]">
                    <img src={img} alt="" className="w-full h-full object-cover"/>
                    <button onClick={() => setEdit({...edit, images: edit.images.filter((_, j) => j !== i)})} className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-bl-md px-1">×</button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-[#E2E8F0] rounded-lg flex items-center justify-center cursor-pointer hover:border-[#84CC16]">
                  <Upload className="w-4 h-4 text-[#65A30D]"/>
                  <input type="file" hidden accept="image/*" onChange={(e) => e.target.files[0] && uploadImg(e.target.files[0])}/>
                </label>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={close} className="btn-outline flex-1 justify-center">Cancel</button>
              <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center" data-testid="save-product">{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
