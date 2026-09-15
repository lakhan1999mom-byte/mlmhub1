import { useEffect, useState, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function HeroSlider({ slides, height = "h-[420px]", testid = "slider" }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSel = () => setIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSel);
    onSel();
    // auto-play every 5s
    const t = setInterval(() => emblaApi.scrollNext(), 5000);
    return () => { clearInterval(t); emblaApi.off("select", onSel); };
  }, [emblaApi]);

  const prev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const next = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  if (!slides?.length) return null;

  return (
    <div className="relative" data-testid={testid}>
      <div className="overflow-hidden rounded-3xl" ref={emblaRef}>
        <div className="flex">
          {slides.map((s, i) => (
            <div key={s.id || i} className={`relative flex-[0_0_100%] ${height} overflow-hidden`}>
              <img src={s.image_url} alt={s.title} className="absolute inset-0 w-full h-full object-cover"/>
              <div className="absolute inset-0 bg-gradient-to-r from-[#7F1D1D]/85 via-[#7F1D1D]/40 to-transparent"/>
              <div className="relative h-full flex items-center px-8 lg:px-16 max-w-3xl">
                <div className="text-white">
                  <h2 className="font-display text-3xl lg:text-5xl font-bold leading-tight mb-3">{s.title}</h2>
                  {s.subtitle && <p className="text-base lg:text-lg text-white/90 mb-5 max-w-xl">{s.subtitle}</p>}
                  {s.cta_label && s.link && (
                    <Link to={s.link} className="inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-[#7F1D1D] font-bold px-6 py-3 rounded-full transition" data-testid={`slider-cta-${i}`}>
                      {s.cta_label} <ChevronRight className="w-4 h-4"/>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-[#7F1D1D] rounded-full w-10 h-10 flex items-center justify-center shadow-lg z-10" data-testid={`${testid}-prev`}>
        <ChevronLeft className="w-5 h-5"/>
      </button>
      <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-[#7F1D1D] rounded-full w-10 h-10 flex items-center justify-center shadow-lg z-10" data-testid={`${testid}-next`}>
        <ChevronRight className="w-5 h-5"/>
      </button>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {slides.map((_, i) => (
          <button key={i} onClick={() => emblaApi && emblaApi.scrollTo(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-8 bg-[#DC2626]" : "w-2 bg-white/60"}`} data-testid={`${testid}-dot-${i}`}/>
        ))}
      </div>
    </div>
  );
}
