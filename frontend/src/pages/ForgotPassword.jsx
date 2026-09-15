import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ChevronRight, ArrowLeft, KeyRound, Copy, X, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import ResendOtpButton from "@/components/ResendOtpButton";

/**
 * Forgot Password — 3 step flow (SMS-independent):
 * 1. Enter phone → server checks if account exists.
 *    • If NOT exists → redirect to /join-now (offer signup).
 *    • If exists → server returns a fresh 6-digit OTP that we show in a popup.
 * 2. Enter OTP → verify.
 *   • If ONE account → move to reset password.
 *   • If MULTIPLE accounts → show picker → user selects → reset password for that account.
 * 3. Enter new password → done → redirect to login.
 */
export default function ForgotPassword() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [popupOtp, setPopupOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const confirmationRef = useRef(null);

  const requestOtp = async () => {
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Enter a valid 10-digit mobile");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/forgot-password/start", { phone });
      if (!data.exists) {
        toast.info("This number is not registered — redirecting to sign up.");
        setTimeout(() => nav(`/join-now?phone=${phone}`), 800);
        return;
      }
      // Show the OTP popup so the user can read + type it in
      setPopupOtp(data.otp);
      setStep(2);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not start reset");
    } finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    if (otp.length < 4) return toast.error("Enter OTP");
    setBusy(true);
    try {
      await api.post("/auth/otp/verify", { phone, otp });
      const { data: lu } = await api.post("/auth/forgot-password/lookup", { phone, otp });
      if (lu.single) {
        setChosen(lu.accounts[0]);
        setStep(3);
      } else {
        setAccounts(lu.accounts);
        setStep(2.5);
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Invalid OTP");
    } finally { setBusy(false); }
  };

  const submitReset = async () => {
    if (newPw.length < 6) return toast.error("Password must be at least 6 characters");
    if (newPw !== confirmPw) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", {
        phone, otp, new_password: newPw,
        user_code: chosen?.user_code,
      });
      toast.success("Password updated! Please login.");
      nav("/login");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Reset failed");
    } finally { setBusy(false); }
  };

  const copyOtp = () => {
    navigator.clipboard.writeText(popupOtp);
    toast.success("OTP copied");
  };

  const useOtp = () => {
    setOtp(popupOtp);
    setPopupOtp("");
    toast.success("OTP filled — tap Verify");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F8FAFC] via-white to-[#FEE2E2]/40 px-4 py-10" data-testid="forgot-password-page">
      <AnimatePresence>
        {popupOtp && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            data-testid="fp-otp-popup"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 relative shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setPopupOtp("")} className="absolute top-3 right-3 text-[#94A3B8] hover:text-[#334155]"><X className="w-5 h-5"/></button>
              <div className="flex items-center gap-2 mb-3 text-amber-700">
                <AlertTriangle className="w-4 h-4"/>
                <div className="text-[10px] uppercase tracking-widest font-bold">SMS temporarily unavailable</div>
              </div>
              <h3 className="font-display font-black text-2xl text-[#7F1D1D]">Your reset OTP</h3>
              <p className="text-xs text-[#64748B] mt-1">Copy this 6-digit code below and paste it in the next step. It expires in 10 minutes.</p>
              <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#FEE2E2] to-[#FECACA] border-2 border-dashed border-[#DC2626]/60 p-5 text-center" data-testid="fp-popup-otp-value">
                <div className="font-numbers font-black text-4xl tracking-[0.4em] text-[#7F1D1D]">{popupOtp}</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={copyOtp} className="btn-outline justify-center text-sm" data-testid="fp-copy-otp"><Copy className="w-4 h-4"/> Copy</button>
                <button onClick={useOtp} className="btn-primary justify-center text-sm" data-testid="fp-use-otp">Use this OTP →</button>
              </div>
              <div className="text-[10px] text-[#94A3B8] mt-3 text-center">This code is unique to <b className="font-numbers text-[#991B1B]">{phone}</b></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md card-soft p-6 md:p-8">
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-[#64748B] hover:text-[#991B1B] mb-4" data-testid="fp-back-link">
          <ArrowLeft className="w-4 h-4"/> Back to Login
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-[#FEE2E2] flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-[#B91C1C]"/>
          </div>
          <div>
            <h1 className="font-display text-2xl font-black text-[#7F1D1D] leading-tight">Reset Password</h1>
            <p className="text-xs text-[#64748B]">Verify your mobile, pick the account, set a new password.</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex-1 h-1 rounded-full transition-colors" style={{ background: step >= n ? "#DC2626" : "#E2E8F0" }}/>
          ))}
        </div>

        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="font-display text-lg font-bold text-[#7F1D1D]">Enter your mobile</h2>
            <input
              className="input-soft font-numbers text-lg"
              placeholder="10-digit mobile"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              data-testid="fp-phone-input"
            />
            <button onClick={requestOtp} disabled={busy || phone.length < 10} className="btn-primary w-full justify-center" data-testid="fp-send-otp-btn">
              {busy ? "Checking…" : "Continue"}
            </button>
            <div className="text-[10px] text-[#94A3B8] text-center">
              If this number isn&apos;t registered, we&apos;ll take you to Sign Up.
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="text-sm text-[#64748B]">OTP generated for <span className="font-numbers font-semibold text-[#7F1D1D]">{phone}</span>. <button onClick={() => { setStep(1); confirmationRef.current = null; setPopupOtp(""); setOtp(""); }} className="text-[#DC2626] font-semibold">Change</button></div>
            <input
              className="input-soft font-numbers tracking-widest text-center text-xl"
              placeholder="------"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              data-testid="fp-otp-input"
            />
            <button onClick={verifyOtp} disabled={busy || otp.length < 4} className="btn-primary w-full justify-center" data-testid="fp-verify-otp-btn">
              {busy ? "Verifying…" : "Verify OTP"}
            </button>
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => { setStep(1); confirmationRef.current = null; setPopupOtp(""); setOtp(""); }} className="text-xs text-[#64748B] hover:text-[#991B1B]" data-testid="fp-change-number-btn">
                Change number
              </button>
              <ResendOtpButton
                onResend={async () => {
                  const { data } = await api.post("/auth/forgot-password/start", { phone });
                  if (data.otp) { setPopupOtp(data.otp); setOtp(""); }
                }}
                testId="fp-resend-otp-btn"
              />
            </div>
          </motion.div>
        )}

        {step === 2.5 && accounts && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3" data-testid="fp-account-picker">
            <div className="rounded-2xl bg-gradient-to-br from-[#7F1D1D] to-[#991B1B] text-white p-4">
              <div className="text-xs uppercase tracking-widest text-[#DC2626] font-bold mb-1">{accounts.length} accounts found</div>
              <div className="font-display font-black text-lg">Which one to reset?</div>
            </div>
            {accounts.map((a) => (
              <button
                key={a.user_code}
                onClick={() => { setChosen(a); setStep(3); }}
                className="w-full text-left card-soft p-4 hover:border-[#DC2626] hover:-translate-y-0.5 transition-all flex items-center justify-between group"
                data-testid={`fp-pick-${a.user_code}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#DC2626] to-[#B91C1C] flex items-center justify-center text-white font-black">
                    {(a.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-[#7F1D1D]">{a.name}</div>
                    {a.username && <div className="text-xs text-[#B91C1C] font-semibold">@{a.username}</div>}
                    <div className="text-[10px] text-[#94A3B8] font-numbers">{a.user_code}</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#DC2626] group-hover:translate-x-1 transition-transform"/>
              </button>
            ))}
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {chosen && (
              <div className="text-xs bg-[#FEE2E2] border border-[#DC2626]/30 text-[#991B1B] rounded-lg p-3">
                Resetting password for <b>{chosen.name}</b> {chosen.username && <>(<span className="font-semibold">@{chosen.username}</span>)</>} — {chosen.user_code}
              </div>
            )}
            <div>
              <label className="text-sm font-semibold text-[#7F1D1D]">New Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"/>
                <input type="password" className="input-soft pl-10" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="min 6 characters" data-testid="fp-new-password"/>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#7F1D1D]">Confirm Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"/>
                <input type="password" className="input-soft pl-10" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="repeat password" data-testid="fp-confirm-password"/>
              </div>
            </div>
            <button onClick={submitReset} disabled={busy} className="btn-primary w-full justify-center" data-testid="fp-submit-btn">
              {busy ? "Updating…" : "Update Password"}
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
