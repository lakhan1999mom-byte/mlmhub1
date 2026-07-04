import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter, Youtube, Mail, Phone, MapPin } from "lucide-react";

const LOGO = "https://customer-assets.emergentagent.com/job_9e593e72-d371-4332-879b-9b25914b11c9/artifacts/xiy5qq2i_ChatGPT_Image_Jun_18__2026__06_43_19_PM-removebg-preview.png";

export default function Footer({ site }) {
  const s = site || {};
  return (
    <footer className="bg-[#064E3B] text-white mt-24" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-4 gap-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <img src={LOGO} alt="EverGro" className="h-16 w-auto"/>
            <div>
              <div className="font-display text-xl font-bold text-white">EverGro eMart</div>
              <div className="text-[10px] tracking-widest text-[#84CC16] uppercase">Shop • Save • Share • Earn</div>
            </div>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            {s.tagline || "Grow your network, grow your wealth. India's transparent MLM hamper platform with timely payouts."}
          </p>
          <div className="flex gap-3 mt-6">
            {s.facebook && <a href={s.facebook} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#84CC16] hover:text-[#064E3B] flex items-center justify-center transition" data-testid="footer-fb"><Facebook className="w-4 h-4"/></a>}
            {s.instagram && <a href={s.instagram} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#84CC16] hover:text-[#064E3B] flex items-center justify-center transition" data-testid="footer-ig"><Instagram className="w-4 h-4"/></a>}
            {s.twitter && <a href={s.twitter} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#84CC16] hover:text-[#064E3B] flex items-center justify-center transition" data-testid="footer-tw"><Twitter className="w-4 h-4"/></a>}
            {s.youtube && <a href={s.youtube} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#84CC16] hover:text-[#064E3B] flex items-center justify-center transition" data-testid="footer-yt"><Youtube className="w-4 h-4"/></a>}
          </div>
        </div>

        <div>
          <h4 className="text-white font-display font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/about" className="hover:text-[#84CC16]" data-testid="footer-about">About Us</Link></li>
            <li><Link to="/business-plan" className="hover:text-[#84CC16]">Business Plan</Link></li>
            <li><Link to="/compensation-plan" className="hover:text-[#84CC16]">Compensation Plan</Link></li>
            <li><Link to="/calculator" className="hover:text-[#84CC16]">Income Calculator</Link></li>
            <li><Link to="/blog" className="hover:text-[#84CC16]">Blog</Link></li>
            <li><Link to="/career" className="hover:text-[#84CC16]">Career</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-display font-semibold mb-4">Legal</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/legal/privacy" className="hover:text-[#84CC16]">Privacy Policy</Link></li>
            <li><Link to="/legal/terms" className="hover:text-[#84CC16]">Terms & Conditions</Link></li>
            <li><Link to="/legal/refund" className="hover:text-[#84CC16]">Refund Policy</Link></li>
            <li><Link to="/legal/shipping" className="hover:text-[#84CC16]">Shipping Policy</Link></li>
            <li><Link to="/faq" className="hover:text-[#84CC16]">FAQ</Link></li>
            <li><Link to="/contact" className="hover:text-[#84CC16]">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-display font-semibold mb-4">Contact</h4>
          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-2"><Phone className="w-4 h-4 mt-0.5 text-[#FBBF24]"/> {s.phone || "+91-9876543210"}</li>
            <li className="flex items-start gap-2"><Mail className="w-4 h-4 mt-0.5 text-[#FBBF24]"/> {s.email || "support@evergroemart.com"}</li>
            <li className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 text-[#FBBF24]"/> {s.address || "India"}</li>
          </ul>
          <div className="mt-6">
            <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Download App</div>
            <div className="flex gap-2">
              <button className="px-3 py-2 bg-white/10 rounded-lg text-xs hover:bg-white/20" data-testid="footer-android-btn">Google Play</button>
              <button className="px-3 py-2 bg-white/10 rounded-lg text-xs hover:bg-white/20" data-testid="footer-ios-btn">App Store</button>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} EverGro eMart. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
