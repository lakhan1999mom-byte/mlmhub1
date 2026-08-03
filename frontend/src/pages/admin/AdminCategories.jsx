import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FolderOpen, Save, X } from "lucide-react";
import api from "@/lib/api";

const blank = { name: "", slug: "", description: "", image_url: "", sort_order: 0, is_active: true };

export default function AdminCategories() {
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/categories").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      if (edit.id) await api.put(`/admin/categories/${edit.id}`, edit);
      else await api.post("/admin/categories", edit);
      toast.success("Category saved");
      setEdit(null); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  const del = async (id, name) => {
    if (!window.confirm(`Delete category "${name}"?`)) return;
    await api.delete(`/admin/categories/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-6" data-testid="admin-categories-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#064E3B]">Categories</h1>
          <p className="text-sm text-[#64748B]">Group your products. Every new product picks a category from this list.</p>
        </div>
        <button onClick={() => setEdit({ ...blank })} className="btn-primary" data-testid="add-category-btn"><Plus className="w-4 h-4"/>Add Category</button>
      </div>

      {items.length === 0 && (
        <div className="card-soft p-12 text-center">
          <FolderOpen className="w-14 h-14 text-[#84CC16] mx-auto mb-3"/>
          <div className="font-display font-bold text-lg text-[#064E3B]">No categories yet</div>
          <div className="text-sm text-[#64748B] mb-4">Create your first category so products can be organised.</div>
          <button onClick={() => setEdit({ ...blank })} className="btn-primary mx-auto"><Plus className="w-4 h-4"/>Add first category</button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((c) => (
          <div key={c.id} className="card-soft p-4 group hover:-translate-y-0.5 transition-transform" data-testid={`category-card-${c.slug}`}>
            <div className="flex items-start gap-3">
              {c.image_url ? (
                <img src={c.image_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0"/>
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[#ECFCCB] flex items-center justify-center flex-shrink-0"><FolderOpen className="w-6 h-6 text-[#65A30D]"/></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-[#064E3B] truncate">{c.name}</div>
                <div className="text-xs text-[#94A3B8] font-mono">{c.slug}</div>
                {c.description && <div className="text-xs text-[#334155] mt-1 line-clamp-2">{c.description}</div>}
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${c.is_active ? "bg-[#ECFCCB] text-[#065F46]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
                {c.is_active ? "Active" : "Inactive"}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setEdit(c)} className="text-xs bg-[#ECFCCB] text-[#065F46] rounded-full px-3 py-1.5 hover:bg-[#D9F99D]" data-testid={`edit-cat-${c.slug}`}><Pencil className="w-3 h-3 inline"/> Edit</button>
                <button onClick={() => del(c.id, c.name)} className="text-xs bg-red-50 text-red-600 rounded-full px-3 py-1.5 hover:bg-red-100" data-testid={`del-cat-${c.slug}`}><Trash2 className="w-3 h-3"/></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()} data-testid="category-edit-modal">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-xl text-[#064E3B]">{edit.id ? "Edit" : "Add"} Category</h3>
              <button onClick={() => setEdit(null)} className="text-[#94A3B8] hover:text-[#334155]"><X className="w-5 h-5"/></button>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#064E3B]">Name</label>
              <input className="input-soft mt-1" placeholder="e.g. Groceries" value={edit.name} onChange={(e) => setEdit({...edit, name: e.target.value})} data-testid="cat-name-input"/>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#064E3B]">Slug <span className="text-xs text-[#94A3B8]">(auto-generated if empty)</span></label>
              <input className="input-soft mt-1 font-mono" placeholder="e.g. groceries" value={edit.slug} onChange={(e) => setEdit({...edit, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")})} data-testid="cat-slug-input"/>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#064E3B]">Description</label>
              <textarea className="input-soft mt-1 min-h-[70px]" placeholder="What products go in this category?" value={edit.description} onChange={(e) => setEdit({...edit, description: e.target.value})}/>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#064E3B]">Image URL (optional)</label>
              <input className="input-soft mt-1" placeholder="https://…" value={edit.image_url} onChange={(e) => setEdit({...edit, image_url: e.target.value})}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-[#064E3B]">Sort Order</label>
                <input type="number" className="input-soft mt-1" value={edit.sort_order} onChange={(e) => setEdit({...edit, sort_order: +e.target.value})}/>
              </div>
              <label className="flex items-center gap-2 self-end pb-3 cursor-pointer">
                <input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({...edit, is_active: e.target.checked})} className="accent-[#84CC16]" data-testid="cat-active-toggle"/>
                <span className="text-sm font-semibold text-[#064E3B]">Active</span>
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEdit(null)} className="btn-outline flex-1 justify-center">Cancel</button>
              <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center" data-testid="save-category-btn">
                {busy ? "Saving…" : <><Save className="w-4 h-4"/>Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
