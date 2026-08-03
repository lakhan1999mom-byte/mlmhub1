import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, Shield, TrendingUp } from "lucide-react";
import api from "@/lib/api";
import { sendFirebaseOtp, toIndianE164 } from "@/lib/firebase";

/**
 * JoinNow — phone-first onboarding.
 * Step 1: Enter phone → OTP (Firebase or dev fallback)
 * Step 2: Complete form (name, username, email, password, sponsor) → account created
 * Step 3: Redirect to /hampers to pay ₹7,200
 */
export default function JoinNow() {
  const nav = useNavigate();
  const [step, setStep] = useState(1); // 1: phone, 2: otp, 3: details
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmationRef = useRef(null);
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", referral_code: "" });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [usernameOk, setUsernameOk] = useState(null);

  const sendOtp = async () => {
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Enter valid 10-digit mobile");
    setBusy(true);
    try {
      try {
        const conf = await sendFirebaseOtp(toIndianE164(phone));
        confirmationRef.current = conf;
        setDevOtp("");
        toast.success("OTP sent via SMS");
      } catch {
        const { data } = await api.post("/auth/otp/send", { phone });
        setDevOtp(data.dev_otp || "");
        toast.success(data.dev_otp ? `Dev OTP: ${data.dev_otp}` : "OTP sent");
      }
      setStep(2);
    } catch (e) {
      toast.error("Could not send OTP");
    } finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    setBusy(true);
    try {
      if (confirmationRef.current) {
        await confirmationRef.current.confirm(otp);
      } else {
        const { data } = await api.post("/auth/otp/verify", { phone, otp });
        // If existing account, tell user and redirect to login. If new, allow registration.
        if (data.token) {
          localStorage.setItem("evergro_token", data.token);
          toast.info("Existing account detected — welcome back!");
          window.location.href = "/dashboard";
          return;
        }
        if (data.multiple) {
          toast.info(`${data.accounts.length} accounts on this number. Use Login instead or continue with a new username.`);
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
      toast.success(`Welcome @${data.user.username}! Now pay ₹7,200 to activate.`);
      nav("/hampers");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Registration failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-16" data-testid="join-now-page">
      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Left benefits */}
        <div className="hidden md:block">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#65A30D] mb-2">Join Now</div>
          <h1 className="font-display text-4xl font-black text-[#064E3B] leading-tight mb-4">
            One number.<br/>Many chances.<br/><span className="text-[#84CC16]">Unlimited income.</span>
          </h1>
          <p className="text-[#334155] mb-6 leading-relaxed">
            Enter your mobile — we'll send an OTP. Once verified, pick a username and pay ₹7,200 to activate your first MLM position. Same phone can be used for multiple accounts.
          </p>
          <div className="space-y-3">
            {[
              { icon: Sparkles, title: "Instant activation", sub: "Account live in under 60 seconds" },
              { icon: Shield, title: "Real SMS OTP", sub: "Firebase-verified phone" },
              { icon: TrendingUp, title: "8-Level Income", sub: "L1=₹1,200 · Total ₹19.2 Cr potential" },
            ].map((b) => (
              <div key={b.title} className="flex items-start gap-3 p-3 bg-[#ECFCCB] rounded-xl">
                <b.icon className="w-5 h-5 text-[#65A30D] flex-shrink-0 mt-0.5"/>
                <div>
                  <div className="font-semibold text-[#064E3B] text-sm">{b.title}</div>
                  <div className="text-xs text-[#64748B]">{b.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right stepper */}
        <div className="card-soft p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6" data-testid="join-stepper">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex-1 h-1 rounded-full" style={{ background: step >= n ? "#84CC16" : "#E2E8F0" }}/>
            ))}
          </div>

          {step === 1 && (
            <>
              <h2 className="font-display text-2xl font-bold text-[#064E3B] mb-1">Enter your mobile</h2>
              <p className="text-sm text-[#64748B] mb-5">We'll send a 6-digit OTP to verify.</p>
              <input
                className="input-soft font-numbers text-lg"
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                data-testid="join-phone-input"
              />
              <button
                onClick={sendOtp}
                disabled={busy || phone.length < 10}
                className="btn-primary w-full justify-center mt-4"
                data-testid="join-send-otp-btn"
              >
                {busy ? "Sending…" : "Send OTP"}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-display text-2xl font-bold text-[#064E3B] mb-1">Enter OTP</h2>
              <p className="text-sm text-[#64748B] mb-5">Sent to {phone}. <button onClick={() => { setStep(1); confirmationRef.current = null; }} className="text-[#84CC16] font-semibold" data-testid="join-change-number">Change</button></p>
              {devOtp && (
                <div className="text-xs bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] rounded-lg p-3 mb-3" data-testid="join-dev-otp">
                  DEV MODE — Your OTP: <b>{devOtp}</b>
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
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-display text-2xl font-bold text-[#064E3B] mb-1">Complete your profile</h2>
              <p className="text-sm text-[#64748B] mb-5">Phone verified ✓. Just a few more details.</p>
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
                    <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold ${usernameOk ? "text-[#65A30D]" : "text-[#EF4444]"}`} data-testid="join-username-status">
                      {usernameOk ? "✓ available" : "✗ taken"}
                    </div>
                  )}
                </div>
                <input className="input-soft" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="join-email-input"/>
                <input className="input-soft" type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="join-password-input"/>
                <input className="input-soft uppercase" placeholder="Sponsor code (optional)" value={form.referral_code} onChange={(e) => setForm({ ...form, referral_code: e.target.value.toUpperCase() })} data-testid="join-referral-input"/>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 accent-[#84CC16]" data-testid="join-terms-checkbox"/>
                  <span className="text-[#334155]">I agree to the <a href="/terms-conditions" target="_blank" rel="noopener" className="text-[#65A30D] underline">Terms & Conditions</a></span>
                </label>
              </div>
              <button onClick={submitRegister} disabled={busy || !termsAccepted || !form.name || !form.username || !form.email || form.password.length < 6 || usernameOk === false} className="btn-primary w-full justify-center mt-4 disabled:opacity-50" data-testid="join-submit-btn">
                {busy ? "Creating…" : "Create Account →"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Recaptcha container (invisible) */}
      <div id="firebase-recaptcha"/>
    </div>
  );
}
