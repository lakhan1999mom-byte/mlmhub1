import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Plus, Pencil, Trash2, Upload, X } from "lucide-react";
import ImageSizeGuide from "@/components/ImageSizeGuide";

const blank = {
  name: "", description: "", price: 0, mrp: 0, sku: "", category: "general", brand: "EverGro",
  gst_percent: 5, stock: 100, images: [], badges: [], is_hamper: false, hamper_tier: null, contents: [],
  sizes: [], colors: [], is_active: true,
};

export default function AdminProducts() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [contentInput, setContentInput] = useState("");

  const load = () => api.get("/products").then(({ data }) => setItems(data));
  const loadCats = () => api.get("/admin/categories").then(({ data }) => setCategories(data));
  useEffect(() => { load(); loadCats(); }, []);

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
              <div className="font-semibold text-[#7F1D1D] truncate">{p.name}</div>
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
              <select
                className="input-soft"
                value={edit.category}
                onChange={(e) => setEdit({...edit, category: e.target.value})}
                data-testid="product-category-select"
              >
                <option value="general">General</option>
                <option value="hamper">Hamper</option>
                {categories.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
              <input className="input-soft" placeholder="Brand" value={edit.brand} onChange={(e) => setEdit({...edit, brand: e.target.value})}/>
              <input className="input-soft" type="number" placeholder="Stock" value={edit.stock} onChange={(e) => setEdit({...edit, stock: +e.target.value})}/>
              <input className="input-soft" type="number" placeholder="GST %" value={edit.gst_percent} onChange={(e) => setEdit({...edit, gst_percent: +e.target.value})}/>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_hamper} onChange={(e) => setEdit({...edit, is_hamper: e.target.checked})}/> This is a Hamper
            </label>
            {edit.is_hamper && (
              <>
                <select className="input-soft" value={edit.hamper_tier || ""} onChange={(e) => setEdit({...edit, hamper_tier: e.target.value})}>
                  <option value="">Select tier</option>
                  <option>Purchasing</option><option>Bronze</option><option>Silver</option><option>Gold</option><option>Platinum</option>
                </select>
                <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-xl p-3">
                  <div className="text-sm font-semibold text-[#7F1D1D] mb-2">📦 Hamper Contents (shown to user)</div>
                  <div className="text-xs text-[#334155] mb-3">Add every item that ships inside this hamper. User can see this list on product page.</div>
                  <div className="flex flex-wrap gap-1.5 mb-2" data-testid="hamper-contents-list">
                    {(edit.contents || []).map((c, i) => (
                      <div key={i} className="inline-flex items-center gap-1 bg-white border border-[#FECACA] rounded-full px-3 py-1 text-xs" data-testid={`hamper-content-${i}`}>
                        <span>{c}</span>
                        <button
                          type="button"
                          onClick={() => setEdit({ ...edit, contents: edit.contents.filter((_, j) => j !== i) })}
                          className="text-[#EF4444] hover:text-red-700"
                          data-testid={`remove-content-${i}`}
                        >
                          <X className="w-3 h-3"/>
                        </button>
                      </div>
                    ))}
                    {(edit.contents || []).length === 0 && (
                      <div className="text-xs text-[#64748B] italic">No items added yet</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="input-soft flex-1"
                      placeholder="Add item (e.g. Premium Basmati Rice 5kg)"
                      value={contentInput}
                      onChange={(e) => setContentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && contentInput.trim()) {
                          e.preventDefault();
                          setEdit({ ...edit, contents: [...(edit.contents || []), contentInput.trim()] });
                          setContentInput("");
                        }
                      }}
                      data-testid="hamper-content-input"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!contentInput.trim()) return;
                        setEdit({ ...edit, contents: [...(edit.contents || []), contentInput.trim()] });
                        setContentInput("");
                      }}
                      className="btn-outline text-sm"
                      data-testid="add-content-btn"
                    >
                      <Plus className="w-3 h-3"/> Add
                    </button>
                  </div>
                </div>
              </>
            )}
            <div>
              <div className="text-sm font-semibold mb-2">Badges (comma-separated)</div>
              <input className="input-soft" value={(edit.badges || []).join(",")} onChange={(e) => setEdit({...edit, badges: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)})}/>
            </div>

            {/* Fashion variants — only meaningful for non-hamper products */}
            {!edit.is_hamper && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3 space-y-3" data-testid="fashion-variants-card">
                <div className="text-sm font-semibold text-[#7F1D1D]">Fashion / Variant Options (optional)</div>
                <div>
                  <div className="text-xs text-[#7F1D1D] mb-1 font-semibold">Sizes (comma-separated, leave blank for none)</div>
                  <input
                    className="input-soft"
                    placeholder="S, M, L, XL, XXL"
                    value={(edit.sizes || []).join(", ")}
                    onChange={(e) => setEdit({...edit, sizes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)})}
                    data-testid="product-sizes-input"
                  />
                </div>
                <div>
                  <div className="text-xs text-[#7F1D1D] mb-1 font-semibold">Colors (comma-separated · names or hex e.g. Red, White, #123456)</div>
                  <input
                    className="input-soft"
                    placeholder="Red, White, Black, #DC2626"
                    value={(edit.colors || []).join(", ")}
                    onChange={(e) => setEdit({...edit, colors: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)})}
                    data-testid="product-colors-input"
                  />
                </div>
                {((edit.sizes || []).length > 0 || (edit.colors || []).length > 0) && (
                  <div className="text-[10px] text-[#B91C1C]">These pickers will appear on the product page and become mandatory before Add to Cart.</div>
                )}
              </div>
            )}
            <div>
              <div className="text-sm font-semibold mb-2">Images</div>
              <ImageSizeGuide preset={edit.is_hamper ? "hamper" : "product"}/>
              <div className="flex flex-wrap gap-2 mt-2">
                {(edit.images || []).map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-[#FAFAF9]">
                    <img src={img} alt="" className="w-full h-full object-cover"/>
                    <button onClick={() => setEdit({...edit, images: edit.images.filter((_, j) => j !== i)})} className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-bl-md px-1">×</button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-[#E2E8F0] rounded-lg flex items-center justify-center cursor-pointer hover:border-[#DC2626]">
                  <Upload className="w-4 h-4 text-[#B91C1C]"/>
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
