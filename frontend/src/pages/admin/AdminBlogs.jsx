import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, X, Trash2, Edit3, ExternalLink, Eye, EyeOff, Search } from "lucide-react";
import api from "@/lib/api";

const blank = {
  title: "", slug: "", excerpt: "", content: "",
  cover_image: "", author: "EverGro Team", is_published: true, tags: [],
};

export default function AdminBlogs() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null); // full blog object being edited

  const load = () => api.get("/admin/blogs?limit=500").then(({ data }) => setItems(data.items));
  useEffect(() => { load(); }, []);

  const filtered = items.filter((b) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (b.title + " " + (b.excerpt || "") + " " + (b.author || "")).toLowerCase().includes(s);
  });

  const togglePublish = async (b) => {
    try {
      await api.put(`/admin/blogs/${b.id}`, { is_published: !b.is_published });
      toast.success(b.is_published ? "Unpublished" : "Published");
      load();
    } catch { toast.error("Failed"); }
  };
  const remove = async (b) => {
    if (!confirm(`Delete "${b.title}"? This cannot be undone.`)) return;
    try { await api.delete(`/admin/blogs/${b.id}`); toast.success("Deleted"); load(); }
    catch { toast.error("Delete failed"); }
  };

  return (
    <div className="space-y-6" data-testid="admin-blogs-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#7F1D1D]">Blog Posts</h1>
          <p className="text-sm text-[#64748B]">Write, edit, publish or unpublish posts. Everything is live the moment you save.</p>
        </div>
        <button onClick={() => setEdit({ ...blank })} className="btn-primary" data-testid="new-blog-btn">
          <Plus className="w-4 h-4"/> New Post
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"/>
        <input className="input-soft pl-9" placeholder="Search title, excerpt, author…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="blog-search"/>
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#FEF2F2] text-left text-xs uppercase">
            <tr>
              <th className="p-3">Post</th><th>Slug</th><th>Author</th><th>Status</th><th>Created</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} className="border-t border-[#FEE2E2]" data-testid={`blog-row-${b.id.slice(0, 8)}`}>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {b.cover_image && <img src={b.cover_image} alt="" className="w-12 h-12 rounded-lg object-cover"/>}
                    <div className="min-w-0">
                      <div className="font-semibold text-[#7F1D1D] line-clamp-1">{b.title}</div>
                      <div className="text-xs text-[#64748B] line-clamp-1">{b.excerpt}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 font-mono text-xs text-[#B91C1C]">/{b.slug}</td>
                <td className="p-3">{b.author}</td>
                <td className="p-3">
                  <button onClick={() => togglePublish(b)} className={`badge-pill inline-flex items-center gap-1 ${b.is_published ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-slate-100 text-slate-600"}`} data-testid={`blog-publish-${b.id.slice(0,8)}`}>
                    {b.is_published ? <><Eye className="w-3 h-3"/> Published</> : <><EyeOff className="w-3 h-3"/> Draft</>}
                  </button>
                </td>
                <td className="p-3 text-xs text-[#64748B]">{new Date(b.created_at).toLocaleDateString()}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <a href={`/blog/${b.slug}`} target="_blank" rel="noreferrer" title="View" className="inline-flex items-center gap-1 text-xs font-semibold text-[#7F1D1D] bg-[#FEE2E2] hover:bg-[#FECACA] px-2 py-1 rounded-lg"><ExternalLink className="w-3 h-3"/></a>
                    <button onClick={() => setEdit(b)} title="Edit" className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] px-2 py-1 rounded-lg" data-testid={`blog-edit-${b.id.slice(0,8)}`}><Edit3 className="w-3 h-3"/></button>
                    <button onClick={() => remove(b)} title="Delete" className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded-lg" data-testid={`blog-delete-${b.id.slice(0,8)}`}><Trash2 className="w-3 h-3"/></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-[#64748B]">No blog posts</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && (
        <EditorModal
          blog={edit}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); load(); }}
        />
      )}
    </div>
  );
}

function EditorModal({ blog, onClose, onSaved }) {
  const [form, setForm] = useState(blog);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const isNew = !blog.id;

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const save = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.content.trim()) return toast.error("Content is required");
    setBusy(true);
    try {
      if (isNew) {
        await api.post("/admin/blogs", form);
        toast.success("Post created");
      } else {
        await api.put(`/admin/blogs/${blog.id}`, form);
        toast.success("Post saved");
      }
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setBusy(false); }
  };

  // Basic auto-slug from title
  const autoSlug = () => {
    const s = (form.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setForm({ ...form, slug: s });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start md:items-center justify-center p-3 overflow-y-auto" onClick={onClose} data-testid="blog-editor-modal">
      <div className="bg-white rounded-3xl max-w-4xl w-full my-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[#FEE2E2] flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-display font-black text-xl text-[#7F1D1D]">{isNew ? "New Post" : "Edit Post"}</h3>
            <div className="text-xs text-[#64748B]">HTML is supported. Use headings, lists, images, links.</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPreview(!preview)} className="text-xs text-[#7F1D1D] font-semibold underline" data-testid="blog-toggle-preview">{preview ? "Edit" : "Preview"}</button>
            <button onClick={onClose} className="text-[#94A3B8] hover:text-[#334155]"><X className="w-5 h-5"/></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-[#7F1D1D]">Title</label>
            <input className="input-soft mt-1" value={form.title} onChange={upd("title")} onBlur={() => { if (!form.slug) autoSlug(); }} data-testid="blog-title-input"/>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-[#7F1D1D]">Slug <button onClick={autoSlug} className="text-[10px] text-[#DC2626] hover:underline ml-1">(regenerate)</button></label>
              <input className="input-soft mt-1 font-mono text-sm" value={form.slug} onChange={upd("slug")} placeholder="my-first-post" data-testid="blog-slug-input"/>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#7F1D1D]">Author</label>
              <input className="input-soft mt-1" value={form.author} onChange={upd("author")} data-testid="blog-author-input"/>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#7F1D1D]">Cover image URL</label>
            <input className="input-soft mt-1" value={form.cover_image} onChange={upd("cover_image")} placeholder="https://…" data-testid="blog-cover-input"/>
            {form.cover_image && <img src={form.cover_image} alt="cover" className="mt-2 rounded-xl max-h-40 object-cover"/>}
          </div>
          <div>
            <label className="text-sm font-semibold text-[#7F1D1D]">Excerpt (2–3 lines shown on the blog list)</label>
            <textarea className="input-soft mt-1 min-h-[70px]" value={form.excerpt} onChange={upd("excerpt")} data-testid="blog-excerpt-input"/>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#7F1D1D]">Content (HTML)</label>
            {preview ? (
              <div className="mt-1 prose prose-slate max-w-none border border-[#FEE2E2] rounded-xl p-4 bg-[#FEF2F2] min-h-[300px]" data-testid="blog-preview-body"
                   dangerouslySetInnerHTML={{ __html: form.content || "<em class='text-slate-400'>Nothing to preview</em>" }}/>
            ) : (
              <textarea className="input-soft mt-1 min-h-[300px] font-mono text-xs" value={form.content} onChange={upd("content")}
                        placeholder="<h2>Section</h2><p>Body text…</p>"
                        data-testid="blog-content-input"/>
            )}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="blog-publish-toggle">
              <input type="checkbox" checked={!!form.is_published} onChange={upd("is_published")}/>
              <span className="font-semibold">Published (visible on public site)</span>
            </label>
            <div className="flex-1"/>
            <div>
              <label className="text-xs font-semibold text-[#7F1D1D]">Tags (comma-separated)</label>
              <input className="input-soft mt-1 text-xs" value={(form.tags || []).join(", ")} onChange={(e) => setForm({...form, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)})} data-testid="blog-tags-input"/>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#FEE2E2] flex gap-2 bg-[#FEF2F2] sticky bottom-0">
          <button onClick={onClose} className="btn-outline flex-1 justify-center">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center" data-testid="blog-save-btn">
            {busy ? "Saving…" : <><Save className="w-4 h-4"/>{isNew ? "Publish Post" : "Save Changes"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
