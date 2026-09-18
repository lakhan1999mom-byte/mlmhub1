import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Shield, TrendingUp, Check, X } from "lucide-react";
import api from "@/lib/api";
import { sendFirebaseOtp, toIndianE164, isFirebaseHostAllowed } from "@/lib/firebase";
import TermsModal from "@/components/TermsModal";
import ResendOtpButton from "@/components/ResendOtpButton";

/**
 * JoinNow — phone-first onboarding.
 * Step 1: Enter phone → OTP (Firebase or dev fallback)
 * Step 2: Complete form (name, username, email, password, sponsor) → account created
 * Step 3: Redirect to /hampers to pay ₹9,999
 */
export default function JoinNow() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(1); // 1: phone, 1.5: existing-choice, 2: otp, 3: details
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [existingCount, setExistingCount] = useState(0);
  const confirmationRef = useRef(null);
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", referral_code: "" });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [usernameOk, setUsernameOk] = useState(null);

  // Pre-fill phone + referral code from query string (e.g. redirect from Forgot Password)
  useEffect(() => {
    const p = (params.get("phone") || "").replace(/\D/g, "").slice(0, 10);
    const ref = (params.get("ref") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (p) setPhone(p);
    if (ref) setForm((f) => ({ ...f, referral_code: ref }));
  }, [params]);

  const sendOtp = async (skipExistingCheck = false) => {
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Enter valid 10-digit mobile");
    setBusy(true);
    try {
      // Check if phone already has accounts — offer choice UNLESS user already picked "re-entry"
      if (!skipExistingCheck) {
        try {
          const { data: st } = await api.get(`/auth/phone-status?phone=${encodeURIComponent(phone)}`);
          if (st.exists) {
            setExistingCount(st.count);
            setStep(1.5);
            setBusy(false);
            return;
          }
        } catch { /* ignore, continue */ }
      }
      await sendOtpForPhone();
      setStep(2);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not send OTP");
    } finally { setBusy(false); }
  };

  // Extracted OTP send so Resend can reuse it
  const sendOtpForPhone = async () => {
    let firebaseFailed = false;
    if (isFirebaseHostAllowed()) {
      try {
        const conf = await sendFirebaseOtp(toIndianE164(phone));
        confirmationRef.current = conf;
        setDevOtp("");
        toast.success("OTP sent to your mobile via SMS");
        return;
      } catch (err) {
        firebaseFailed = true;
        // eslint-disable-next-line no-console
        console.warn("[Firebase] failed", err?.code, err?.message);
      }
    }
    const { data } = await api.post("/auth/otp/send", { phone });
    setDevOtp(data.dev_otp || "");
    if (firebaseFailed) {
      toast.warning("SMS provider temporarily unavailable — contact support if OTP does not arrive.", { duration: 6000 });
    } else {
      toast.success(data.dev_otp ? `OTP sent (${data.dev_otp})` : "OTP sent to your mobile");
    }
  };

  const verifyOtp = async () => {
    setBusy(true);
    try {
      if (confirmationRef.current) {
        await confirmationRef.current.confirm(otp);
      } else {
        const { data } = await api.post("/auth/otp/verify", { phone, otp });
        // Since Join Now is for re-entry (user chose to create NEW account), do NOT auto-login.
        // Just validate the OTP and move to step 3. If phone had no accounts, `verified: true`.
        if (data.verified === false) {
          throw new Error("Invalid OTP");
        }
      }
      setStep(3);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Invalid OTP");
    } finally { setBusy(false); }
  };

  const checkUsername = async (u) => {
    if (u.length < 3) return setUsernameOk(null);
    try {
      const { data } = await api.get(`/auth/check-username?username=${encodeURIComponent(u)}`);
      setUsernameOk(data.available);
    } catch { setUsernameOk(null); }
  };

  const submitRegister = async () => {
    if (!termsAccepted) return toast.error("Accept Terms first");
    if (usernameOk === false) return toast.error("Pick another username");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/register", { ...form, phone, terms_accepted: true });
      localStorage.setItem("evergro_token", data.token);
      toast.success(`Welcome @${data.user.username}! Purchase the ₹9,999 kit anytime from your dashboard to activate.`);
      // Land on dashboard — kit purchase is mandatory but not forced landing.
      nav("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Registration failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-16" data-testid="join-now-page">
      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Left benefits */}
        <div className="hidden md:block">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#B91C1C] mb-2">Join Now</div>
          <h1 className="font-display text-4xl font-black text-[#7F1D1D] leading-tight mb-4">
            Premium hampers.<br/>Many gift bundles.<br/><span className="text-[#DC2626]">Delivered pan-India.</span>
          </h1>
          <p className="text-[#334155] mb-6 leading-relaxed">
            Enter your mobile — we&apos;ll send an OTP. Once verified, pick a username and pay ₹9,999 to activate your partner account.
          </p>
          <div className="space-y-3">
            {[
              { icon: Sparkles, title: "Instant activation", sub: "Account live in under 60 seconds" },
              { icon: Shield, title: "Real SMS OTP", sub: "Firebase-verified phone" },
              { icon: TrendingUp, title: "Rewards", sub: "Unlock the referral rewards program" },
            ].map((b) => (
              <div key={b.title} className="flex items-start gap-3 p-3 bg-[#FEE2E2] rounded-xl">
                <b.icon className="w-5 h-5 text-[#B91C1C] flex-shrink-0 mt-0.5"/>
                <div>
                  <div className="font-semibold text-[#7F1D1D] text-sm">{b.title}</div>
                  <div className="text-xs text-[#64748B]">{b.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right stepper */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="card-soft p-6 md:p-8 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-[#DC2626]/10 rounded-full blur-2xl"/>
          <div className="relative">
          <div className="flex items-center gap-2 mb-6" data-testid="join-stepper">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex-1 relative">
                <div className="h-1 rounded-full bg-[#E2E8F0]"/>
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: step >= n ? 1 : 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 h-1 rounded-full bg-gradient-to-r from-[#DC2626] to-[#B91C1C] origin-left"
                />
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <h2 className="font-display text-2xl font-bold text-[#7F1D1D] mb-1">Enter your mobile</h2>
              <p className="text-sm text-[#64748B] mb-5">We&apos;ll send a 6-digit OTP to verify.</p>
              <input
                className="input-soft font-numbers text-lg"
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                data-testid="join-phone-input"
              />
              <button
                onClick={() => sendOtp(false)}
                disabled={busy || phone.length < 10}
                className="btn-primary w-full justify-center mt-4"
                data-testid="join-send-otp-btn"
              >
                {busy ? "Sending…" : "Send OTP"}
              </button>
            </motion.div>
          )}

          {step === 1.5 && (
            <motion.div key="s15" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} data-testid="join-existing-choice">
              <div className="rounded-2xl bg-gradient-to-br from-[#FEF2F2] to-[#FEE2E2] p-4 mb-4 border border-[#B91C1C]/30">
                <div className="text-xs uppercase tracking-widest font-bold text-[#7F1D1D] mb-1">Heads up</div>
                <div className="font-display font-black text-[#7C2D12] text-lg leading-tight">This number already has {existingCount} account{existingCount > 1 ? "s" : ""}</div>
                <div className="text-xs text-[#7F1D1D] mt-1">You can either login to your existing account, or create a NEW re-entry position on the same number (must use a different referral code).</div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => nav(`/login?phone=${phone}`)}
                  className="w-full text-left card-soft p-4 hover:border-[#DC2626] hover:-translate-y-0.5 transition-all flex items-center justify-between group border-2 border-[#DC2626]/40"
                  data-testid="join-choice-login"
                >
                  <div>
                    <div className="font-semibold text-[#7F1D1D]">Login to your existing account</div>
                    <div className="text-xs text-[#64748B]">Skip signup — go straight to your dashboard</div>
                  </div>
                  <div className="text-[#DC2626] group-hover:translate-x-1 transition-transform">→</div>
                </button>
                <div className="w-full card-soft p-4 flex items-center justify-between opacity-70" data-testid="join-choice-reentry">
                  <div>
                    <div className="font-semibold text-[#7F1D1D]">Add another referral business</div>
                    <div className="text-xs text-[#64748B]">Once logged in, open <b>Create Referral Business</b> on your dashboard (each requires its own ₹9,999 kit).</div>
                  </div>
                  <div className="text-[10px] font-bold uppercase text-[#94A3B8]">soon</div>
                </div>
                <button onClick={() => { setStep(1); setExistingCount(0); }} className="text-sm text-[#64748B] hover:text-[#991B1B] w-full text-center pt-2" data-testid="join-choice-back">
                  ← Use a different number
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <h2 className="font-display text-2xl font-bold text-[#7F1D1D] mb-1">Enter OTP</h2>
              <p className="text-sm text-[#64748B] mb-5">Sent to {phone}. <button onClick={() => { setStep(1); confirmationRef.current = null; }} className="text-[#DC2626] font-semibold" data-testid="join-change-number">Change</button></p>
              {devOtp && (
                <div className="text-xs bg-[#FEF2F2] border border-[#FCA5A5] text-[#7F1D1D] rounded-lg p-3 mb-3" data-testid="join-dev-otp">
                  Preview — Your OTP: <b>{devOtp}</b>
                </div>
              )}
              <input
                className="input-soft font-numbers tracking-widest text-center text-xl"
                placeholder="------"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                data-testid="join-otp-input"
              />
              <button onClick={verifyOtp} disabled={busy || otp.length < 4} className="btn-primary w-full justify-center mt-4" data-testid="join-verify-otp-btn">
                {busy ? "Verifying…" : "Verify & Continue"}
              </button>
              <div className="flex items-center justify-between pt-3">
                <button onClick={() => { setStep(1); confirmationRef.current = null; }} className="text-xs text-[#64748B] hover:text-[#991B1B]" data-testid="join-change-number-2">
                  Change number
                </button>
                <ResendOtpButton
                  onResend={sendOtpForPhone}
                  testId="join-resend-otp-btn"
                />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <h2 className="font-display text-2xl font-bold text-[#7F1D1D] mb-1">Complete your profile</h2>
              <p className="text-sm text-[#64748B] mb-5">Phone verified <Check className="w-4 h-4 inline text-[#B91C1C]"/>. Just a few more details.</p>
              <div className="space-y-3">
                <input className="input-soft" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="join-name-input"/>
                <div className="relative">
                  <input
                    className="input-soft lowercase"
                    placeholder="Choose a unique @username"
                    value={form.username}
                    onChange={(e) => {
                      const v = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "");
                      setForm({ ...form, username: v });
                      checkUsername(v);
                    }}
                    data-testid="join-username-input"
                  />
                  {form.username && usernameOk !== null && (
                    <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold flex items-center gap-1 ${usernameOk ? "text-[#B91C1C]" : "text-[#EF4444]"}`} data-testid="join-username-status">
                      {usernameOk ? <><Check className="w-3 h-3"/> available</> : <><X className="w-3 h-3"/> taken</>}
                    </div>
                  )}
                </div>
                <input className="input-soft" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="join-email-input"/>
                <input className="input-soft" type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="join-password-input"/>
                <input className="input-soft uppercase" placeholder="Referral code (optional)" value={form.referral_code} onChange={(e) => setForm({ ...form, referral_code: e.target.value.toUpperCase() })} data-testid="join-referral-input"/>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 accent-[#DC2626]" data-testid="join-terms-checkbox"/>
                  <span className="text-[#334155]">
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setTermsModalOpen(true)}
                      className="text-[#B91C1C] underline font-semibold hover:text-[#4D7C0F]"
                      data-testid="join-terms-link"
                    >
                      Terms & Conditions
                    </button>
                  </span>
                </label>
              </div>
              <button onClick={submitRegister} disabled={busy || !termsAccepted || !form.name || !form.username || !form.email || form.password.length < 6 || usernameOk === false} className="btn-primary w-full justify-center mt-4 disabled:opacity-50" data-testid="join-submit-btn">
                {busy ? "Creating…" : "Create Account →"}
              </button>
            </motion.div>
          )}
          </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Recaptcha container (invisible) */}
      <div id="firebase-recaptcha"/>

      {/* Terms & Conditions modal */}
      <TermsModal
        open={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        onAccept={() => { setTermsAccepted(true); toast.success("Terms accepted"); }}
      />
    </div>
  );
}
