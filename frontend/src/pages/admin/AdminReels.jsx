import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Plus, Trash2, Upload, Pencil, Play } from "lucide-react";
import ImageSizeGuide from "@/components/ImageSizeGuide";

const blank = { title: "", description: "", video_url: "", thumbnail_url: "", location: "both", is_active: true, sort_order: 1 };

export default function AdminReels() {
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/reels").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const uploadVideo = async (file) => {
    if (file.size > 50 * 1024 * 1024) { toast.error("Max 50 MB"); return; }
    const fd = new FormData(); fd.append("file", file);
    toast.info("Uploading video — may take a minute…");
    const { data } = await api.post("/cloudinary/upload?folder=reels/videos", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setEdit((r) => ({ ...r, video_url: data.url }));
    toast.success("Video uploaded");
  };
  const uploadThumb = async (file) => {
    const fd = new FormData(); fd.append("file", file);
    const { data } = await api.post("/cloudinary/upload?folder=reels/thumbs", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setEdit((r) => ({ ...r, thumbnail_url: data.url }));
    toast.success("Thumbnail uploaded");
  };

  const save = async () => {
    if (!edit.video_url) { toast.error("Please add a video URL"); return; }
    setBusy(true);
    try {
      if (edit.id) await api.put(`/admin/reels/${edit.id}`, edit);
      else await api.post("/admin/reels", edit);
      toast.success("Saved");
      setEdit(null);
      load();
    } catch { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this reel?")) return;
    await api.delete(`/admin/reels/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-6" data-testid="admin-reels-page">
      <div className="flex justify-between items-center">
        <h1 className="font-display text-3xl font-bold">Reels (Vertical Videos)</h1>
        <button onClick={() => setEdit({ ...blank })} className="btn-primary" data-testid="add-reel-btn"><Plus className="w-4 h-4"/>Add Reel</button>
      </div>

      <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {items.map((r) => (
          <div key={r.id} className="card-soft overflow-hidden" data-testid={`reel-${r.id}`}>
            <div className="aspect-[9/16] bg-black relative">
              {r.thumbnail_url && <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover opacity-80"/>}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/90 rounded-full w-10 h-10 flex items-center justify-center">
                  <Play className="w-4 h-4 text-[#064E3B] ml-0.5"/>
                </div>
              </div>
            </div>
            <div className="p-3">
              <div className="font-semibold text-xs text-[#064E3B] line-clamp-2">{r.title}</div>
              <div className="text-[10px] text-[#65A30D] font-numbers mt-1 capitalize">{r.location} · {r.is_active ? "Active" : "Off"}</div>
              <div className="flex gap-1 mt-2">
                <button onClick={() => setEdit({...r})} className="text-xs bg-[#ECFCCB] text-[#064E3B] rounded-full px-2 py-1 flex items-center gap-1"><Pencil className="w-3 h-3"/></button>
                <button onClick={() => del(r.id)} className="text-xs bg-red-50 text-red-600 rounded-full px-2 py-1" data-testid={`del-reel-${r.id}`}><Trash2 className="w-3 h-3"/></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-3">
            <h3 className="font-display font-bold text-xl">{edit.id ? "Edit" : "Add"} Reel</h3>
            <input className="input-soft" placeholder="Title" value={edit.title} onChange={(e) => setEdit({...edit, title: e.target.value})} data-testid="reel-title"/>
            <textarea className="input-soft min-h-[60px]" placeholder="Description (optional)" value={edit.description} onChange={(e) => setEdit({...edit, description: e.target.value})}/>
            <select className="input-soft" value={edit.location} onChange={(e) => setEdit({...edit, location: e.target.value})}>
              <option value="both">Show on Landing AND User Dashboard</option>
              <option value="landing">Landing only</option>
              <option value="user">User Dashboard only</option>
            </select>
            <input type="number" className="input-soft" placeholder="Sort Order" value={edit.sort_order} onChange={(e) => setEdit({...edit, sort_order: +e.target.value})}/>
            <div>
              <div className="text-sm font-semibold mb-2">Video (mp4, ideally 9:16 vertical, max 50 MB)</div>
              <ImageSizeGuide preset="reel"/>
              {edit.video_url ? (
                <video src={edit.video_url} controls className="rounded-lg max-h-60 w-full bg-black mt-2"/>
              ) : (
                <label className="block border-2 border-dashed border-[#E2E8F0] rounded-lg p-6 text-center cursor-pointer hover:border-[#84CC16]">
                  <Upload className="w-5 h-5 mx-auto text-[#65A30D] mb-2"/>
                  <div className="text-sm">Upload Video</div>
                  <input type="file" hidden accept="video/mp4,video/*" onChange={(e) => e.target.files[0] && uploadVideo(e.target.files[0])}/>
                </label>
              )}
              <input className="input-soft mt-2" placeholder="OR paste video URL (mp4)" value={edit.video_url} onChange={(e) => setEdit({...edit, video_url: e.target.value})}/>
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">Thumbnail (optional)</div>
              <div className="flex items-center gap-2">
                {edit.thumbnail_url && <img src={edit.thumbnail_url} alt="" className="w-16 h-24 object-cover rounded-lg"/>}
                <label className="btn-outline text-xs cursor-pointer">
                  <Upload className="w-3 h-3"/>Upload
                  <input type="file" hidden accept="image/*" onChange={(e) => e.target.files[0] && uploadThumb(e.target.files[0])}/>
                </label>
              </div>
              <input className="input-soft mt-2" placeholder="OR paste thumbnail URL" value={edit.thumbnail_url} onChange={(e) => setEdit({...edit, thumbnail_url: e.target.value})}/>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!edit.is_active} onChange={(e) => setEdit({...edit, is_active: e.target.checked})}/> Active
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEdit(null)} className="btn-outline flex-1 justify-center">Cancel</button>
              <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center" data-testid="save-reel">{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
