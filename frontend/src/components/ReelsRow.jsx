import { useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, X } from "lucide-react";

export default function ReelsRow({ reels, title = "Watch & Win", testid = "reels-row" }) {
  const [open, setOpen] = useState(null); // open reel index
  if (!reels?.length) return null;
  return (
    <section className="py-12" data-testid={testid}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">Stories • Demos • Success</div>
            <h2 className="font-display text-3xl lg:text-4xl font-bold">{title}</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
          {reels.map((r, i) => (
            <ReelCard key={r.id || i} reel={r} onOpen={() => setOpen(i)} testid={`${testid}-card-${i}`}/>
          ))}
        </div>
      </div>
      {open !== null && (
        <ReelPlayer reels={reels} startIndex={open} onClose={() => setOpen(null)}/>
      )}
    </section>
  );
}

function ReelCard({ reel, onOpen, testid }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.paused) { videoRef.current.play(); setPlaying(true); }
    else { videoRef.current.pause(); setPlaying(false); }
  };

  return (
    <button onClick={onOpen} className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all" data-testid={testid}>
      <video
        ref={videoRef}
        src={reel.video_url}
        poster={reel.thumbnail_url}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
        onMouseEnter={(e) => { e.target.play().catch(() => {}); setPlaying(true); }}
        onMouseLeave={(e) => { e.target.pause(); setPlaying(false); }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"/>
      {/* play overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-white/90 rounded-full w-12 h-12 flex items-center justify-center">
          {playing ? <Pause className="w-5 h-5 text-[#064E3B]"/> : <Play className="w-5 h-5 text-[#064E3B] ml-1"/>}
        </div>
      </div>
      <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5" onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}>
        {muted ? <VolumeX className="w-3.5 h-3.5 text-white"/> : <Volume2 className="w-3.5 h-3.5 text-white"/>}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
        <div className="font-display font-semibold text-white text-sm line-clamp-2">{reel.title}</div>
        {reel.description && <div className="text-[10px] text-white/70 mt-1 line-clamp-1">{reel.description}</div>}
      </div>
    </button>
  );
}

function ReelPlayer({ reels, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const reel = reels[idx];
  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4" data-testid="reel-player">
      <button onClick={onClose} className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center z-10" data-testid="reel-close">
        <X className="w-5 h-5"/>
      </button>
      <div className="relative max-w-md w-full h-[80vh] rounded-3xl overflow-hidden bg-black">
        <video
          src={reel.video_url}
          poster={reel.thumbnail_url}
          autoPlay
          loop
          playsInline
          controls
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 to-transparent">
          <div className="font-display font-bold text-white text-lg">{reel.title}</div>
          {reel.description && <div className="text-sm text-white/80 mt-1">{reel.description}</div>}
        </div>
      </div>
      {idx > 0 && <button onClick={() => setIdx(idx - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-white/10 rounded-full w-10 h-10 flex items-center justify-center">‹</button>}
      {idx < reels.length - 1 && <button onClick={() => setIdx(idx + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-white/10 rounded-full w-10 h-10 flex items-center justify-center">›</button>}
    </div>
  );
}
