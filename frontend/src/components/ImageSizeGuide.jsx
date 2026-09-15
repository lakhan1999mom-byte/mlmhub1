/**
 * Size guide reference used by admin CMS screens.
 * Renders as a small info banner explaining recommended dimensions.
 */
import { Info } from "lucide-react";

export const IMAGE_SIZES = {
  logo: { label: "Logo", w: 400, h: 120, ratio: "landscape (3.3:1)", note: "PNG with transparent background. Max 300 KB." },
  favicon: { label: "Favicon", w: 64, h: 64, ratio: "square (1:1)", note: "PNG or ICO. Max 30 KB." },
  banner: { label: "Home Banner", w: 1600, h: 600, ratio: "wide (8:3)", note: "JPG or WEBP. Max 500 KB. Keep key content centered." },
  slider: { label: "Slider Image", w: 1600, h: 700, ratio: "wide (16:7)", note: "JPG/WEBP. Max 500 KB." },
  reel: { label: "Reel Video Thumbnail", w: 720, h: 1280, ratio: "vertical (9:16)", note: "Actual video should be MP4, <15 MB, 9:16." },
  product: { label: "Product Image", w: 1200, h: 1200, ratio: "square (1:1)", note: "JPG/WEBP. Max 400 KB. White or plain background preferred." },
  hamper: { label: "Hamper Image", w: 1200, h: 1200, ratio: "square (1:1)", note: "Same as product." },
  brand_logo: { label: "Partner Brand Logo", w: 400, h: 200, ratio: "landscape (2:1)", note: "PNG with transparent background. Max 150 KB." },
  avatar: { label: "User Avatar / Testimonial Photo", w: 200, h: 200, ratio: "square (1:1)", note: "JPG/PNG. Max 100 KB." },
  kyc_doc: { label: "KYC Document Scan", w: 1600, h: 1000, ratio: "any", note: "JPG/PDF. Max 3 MB. Must be legible." },
};

export default function ImageSizeGuide({ preset = "product", extraNote = null }) {
  const p = IMAGE_SIZES[preset] || IMAGE_SIZES.product;
  return (
    <div className="p-3 bg-[#FEF9C3] border border-[#FCA5A5] rounded-xl text-xs text-[#7F1D1D] flex items-start gap-2" data-testid={`size-guide-${preset}`}>
      <Info className="w-4 h-4 flex-shrink-0 mt-0.5"/>
      <div>
        <div className="font-semibold">
          Recommended: {p.w}×{p.h}px · {p.ratio}
        </div>
        <div className="opacity-90 mt-0.5">{p.note}{extraNote ? " " + extraNote : ""}</div>
      </div>
    </div>
  );
}

export function AllSizesTable() {
  return (
    <div className="card-soft p-4" data-testid="all-size-guides">
      <div className="font-display font-bold text-[#7F1D1D] mb-3">Image Upload Size Guide</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[#64748B]">
              <th className="py-2">Where</th>
              <th>Dimensions (px)</th>
              <th>Aspect Ratio</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(IMAGE_SIZES).map(([key, p]) => (
              <tr key={key} className="border-t border-[#E2E8F0]">
                <td className="py-2 font-semibold text-[#7F1D1D]">{p.label}</td>
                <td className="font-numbers">{p.w}×{p.h}</td>
                <td>{p.ratio}</td>
                <td className="text-[#334155]">{p.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
