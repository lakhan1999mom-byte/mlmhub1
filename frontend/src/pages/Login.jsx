import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, Phone, ShieldCheck, LogIn, UserPlus, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";

/**
 * Iteration 15 — simplified 2-tab Login (Mobile / Email + Password).
 * No username tab. No OTP-based login. Forgot Password uses OTP.
 * Remember Me stores identifier in localStorage.
 */
export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const qp = new URLSearchParams(loc.search);
  const preFillPhone = qp.get("phone") || "";
  const preFillEmail = qp.get("email") || "";

  const initialTab = preFillEmail ? "email" : "mobile";
  const [tab, setTab] = useState(initialTab);
  const [identifier, setIdentifier] = useState(preFillPhone || preFillEmail || "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  // Restore remembered identifier
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("evergro_remember") || "null");
    if (saved && !preFillPhone && !preFillEmail) {
      setTab(saved.tab || "mobile");
      setIdentifier(saved.identifier || "");
    }
  }, [preFillPhone, preFillEmail]);

  const submit = async (e) => {
    e?.preventDefault();
    const val = identifier.trim();
    if (!val || !password) return toast.error("Enter your credentials");
    if (tab === "mobile" && val.replace(/\D/g, "").length < 10) {
      return toast.error("Enter a valid 10-digit mobile");
    }
    if (tab === "email" && !val.includes("@")) {
      return toast.error("Enter a valid email");
    }
    setBusy(true);
    try {
      const u = await login(val, password);
      if (remember) {
        localStorage.setItem("evergro_remember", JSON.stringify({ tab, identifier: val }));
      } else {
        localStorage.removeItem("evergro_remember");
      }
      toast.success(`Welcome back, ${u.name}!`);
      const target = loc.state?.from?.pathname || (u.role === "user" ? "/dashboard" : "/admin");
      nav(target);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Wrong credentials");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-10" data-testid="login-page">
      {/* Premium background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#064E3B] via-[#065F46] to-[#166534]"/>
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#84CC16] rounded-full mix-blend-overlay blur-[100px] animate-pulse"/>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#FBBF24] rounded-full mix-blend-overlay blur-[100px] animate-pulse" style={{ animationDelay: "1s" }}/>
      </div>
      {/* Grain overlay */}
      <div className="absolute inset-0 opacity-[0.08]" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}/>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md bg-white/95 backdrop-blur-xl rounded-[28px] p-8 shadow-2xl border border-white/40"
      >
        {/* Header */}
        <div className="text-center mb-7">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
            className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#84CC16] to-[#65A30D] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#84CC16]/30"
          >
            <ShieldCheck className="w-8 h-8 text-white"/>
          </motion.div>
          <h1 className="font-display text-3xl font-black text-[#064E3B] leading-tight">Welcome back</h1>
          <p className="text-sm text-[#64748B] mt-1">Sign in to continue to your dashboard</p>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 bg-[#F1F5F9] p-1 rounded-full mb-5 relative">
          <motion.div
            layoutId="login-tab-indicator"
            className="absolute inset-y-1 bg-white rounded-full shadow-sm"
            style={{ width: "calc(50% - 4px)" }}
            animate={{ x: tab === "mobile" ? 0 : "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
          <button onClick={() => setTab("mobile")} className={`relative z-10 py-2 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${tab === "mobile" ? "text-[#064E3B]" : "text-[#64748B]"}`} data-testid="login-tab-mobile">
            <Phone className="w-3.5 h-3.5"/> Mobile
          </button>
          <button onClick={() => setTab("email")} className={`relative z-10 py-2 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${tab === "email" ? "text-[#064E3B]" : "text-[#64748B]"}`} data-testid="login-tab-email">
            <Mail className="w-3.5 h-3.5"/> Email
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <label className="text-xs font-bold text-[#064E3B] uppercase tracking-wider">{tab === "mobile" ? "Mobile Number" : "Email Address"}</label>
              <div className="relative mt-1">
                {tab === "mobile" ? <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"/> : <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"/>}
                <input
                  className={`input-soft pl-10 ${tab === "mobile" ? "font-numbers" : ""}`}
                  placeholder={tab === "mobile" ? "10-digit mobile" : "you@example.com"}
                  value={identifier}
                  onChange={(e) => setIdentifier(tab === "mobile" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value)}
                  data-testid={`login-${tab}-input`}
                  inputMode={tab === "mobile" ? "numeric" : "email"}
                  autoComplete={tab === "mobile" ? "tel" : "email"}
                />
              </div>
            </motion.div>
          </AnimatePresence>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#064E3B] uppercase tracking-wider">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-[#65A30D] hover:text-[#4D7C0F]" data-testid="forgot-password-link">Forgot?</Link>
            </div>
            <div className="relative mt-1">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"/>
              <input
                type={showPw ? "text" : "password"}
                className="input-soft pl-10 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                data-testid="login-password-input"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#334155]" aria-label="Toggle password visibility" data-testid="toggle-password-btn">
                {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-[#84CC16]" data-testid="remember-me-checkbox"/>
            <span className="text-sm text-[#334155]">Remember me on this device</span>
          </label>

          <motion.button
            type="submit" disabled={busy}
            whileTap={{ scale: 0.98 }}
            className="btn-primary w-full justify-center text-base py-3"
            data-testid="login-submit-btn"
          >
            {busy ? "Signing in…" : (<><LogIn className="w-4 h-4"/> Sign in</>)}
          </motion.button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-[#E2E8F0]"/>
          <span className="text-xs text-[#94A3B8] uppercase tracking-widest">New here?</span>
          <div className="flex-1 h-px bg-[#E2E8F0]"/>
        </div>

        <Link
          to="/join-now"
          className="btn-outline w-full justify-center py-3 group"
          data-testid="join-now-link"
        >
          <UserPlus className="w-4 h-4 group-hover:rotate-12 transition-transform"/> Create free account
          <Sparkles className="w-3 h-3 text-[#FBBF24]"/>
        </Link>

        <p className="mt-5 text-[10px] text-center text-[#94A3B8] uppercase tracking-widest flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3"/> Secure · Encrypted · Trusted
        </p>
      </motion.div>
    </div>
  );
}
