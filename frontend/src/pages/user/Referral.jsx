import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Share2 } from "lucide-react";

export default function Referral() {
  const { user } = useAuth();
  if (!user) return null;
  const link = `${window.location.origin}/register?ref=${user.referral_code}`;

  const copy = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied!");
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: "Join EverGro eMart", text: "Join me on EverGro eMart and start earning!", url: link });
    } else { copy(); }
  };

  return (
    <div className="space-y-6" data-testid="referral-page">
      <h1 className="font-display text-3xl font-bold">My Referral</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card-soft p-6">
          <h3 className="font-display font-bold text-lg mb-3">Referral Link</h3>
          <div className="bg-[#F1F5F9] rounded-xl p-3 font-mono text-xs break-all mb-3" data-testid="referral-link">{link}</div>
          <div className="flex gap-2">
            <button onClick={copy} className="btn-outline text-sm" data-testid="copy-link-btn"><Copy className="w-4 h-4"/> Copy</button>
            <button onClick={share} className="btn-primary text-sm" data-testid="share-link-btn"><Share2 className="w-4 h-4"/> Share</button>
          </div>
          <div className="mt-6 text-sm">
            <div>Your Referral Code: <span className="font-numbers font-bold text-lg text-[#DC2626]">{user.referral_code}</span></div>
            <div className="mt-2">Direct Referrals: <b className="font-numbers">{user.direct_referrals_count}</b></div>
            <div>Team Size: <b className="font-numbers">{user.team_size}</b></div>
          </div>
        </div>
        <div className="card-soft p-6 text-center">
          <h3 className="font-display font-bold text-lg mb-3">QR Code</h3>
          <div className="inline-block p-4 bg-white rounded-2xl border border-[#E2E8F0]">
            <QRCodeSVG value={link} size={220} fgColor="#7F1D1D"/>
          </div>
          <p className="text-xs text-[#64748B] mt-3">Scan to register under you</p>
        </div>
      </div>
    </div>
  );
}
