import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";

const LOGO = "https://customer-assets.emergentagent.com/job_9e593e72-d371-4332-879b-9b25914b11c9/artifacts/xiy5qq2i_ChatGPT_Image_Jun_18__2026__06_43_19_PM-removebg-preview.png";

export default function Footer({ site }) {
  const s = site || {};
  const hasAnySocial = s.facebook || s.instagram || s.twitter || s.youtube;
  return (
    <footer className="bg-[#7F1D1D] text-white mt-24" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <img src={LOGO} alt="EverGro" className="h-16 w-auto"/>
            <div>
              <div className="font-display text-xl font-bold text-white">EverGro eMart</div>
              <div className="text-[10px] tracking-widest text-[#FCA5A5] uppercase">Premium Products · Home Delivered</div>
            </div>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            {s.tagline || "Hand-picked hampers and daily essentials from India's most loved brands, delivered with care."}
          </p>
          {hasAnySocial && (
            <div className="flex gap-3 mt-6">
              {s.facebook && <a href={s.facebook} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#DC2626] flex items-center justify-center transition" data-testid="footer-fb"><Facebook className="w-4 h-4"/></a>}
              {s.instagram && <a href={s.instagram} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#DC2626] flex items-center justify-center transition" data-testid="footer-ig"><Instagram className="w-4 h-4"/></a>}
              {s.twitter && <a href={s.twitter} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#DC2626] flex items-center justify-center transition" data-testid="footer-tw"><Twitter className="w-4 h-4"/></a>}
              {s.youtube && <a href={s.youtube} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#DC2626] flex items-center justify-center transition" data-testid="footer-yt"><Youtube className="w-4 h-4"/></a>}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-white font-display font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/about" className="hover:text-[#FCA5A5]" data-testid="footer-about">About Us</Link></li>
            <li><Link to="/products" className="hover:text-[#FCA5A5]">Shop</Link></li>
            <li><Link to="/hampers" className="hover:text-[#FCA5A5]">Hampers</Link></li>
            <li><Link to="/blog" className="hover:text-[#FCA5A5]">Blog</Link></li>
            <li><Link to="/career" className="hover:text-[#FCA5A5]">Career</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-display font-semibold mb-4">Legal</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/legal/privacy" className="hover:text-[#FCA5A5]">Privacy Policy</Link></li>
            <li><Link to="/legal/terms" className="hover:text-[#FCA5A5]">Terms & Conditions</Link></li>
            <li><Link to="/legal/refund" className="hover:text-[#FCA5A5]">Refund Policy</Link></li>
            <li><Link to="/legal/shipping" className="hover:text-[#FCA5A5]">Shipping Policy</Link></li>
            <li><Link to="/faq" className="hover:text-[#FCA5A5]">FAQ</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-xs text-white/60">
          © {new Date().getFullYear()} EverGro eMart. All rights reserved. <br className="sm:hidden"/>
          <span className="text-white/80">EverGro eMart is controlled by <b>PK and Son LLP</b>.</span>
        </div>
      </div>
    </footer>
  );
}
