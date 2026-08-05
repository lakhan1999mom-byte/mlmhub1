import { useEffect, useState, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

/**
 * Resend OTP button with a built-in cooldown timer.
 * Props:
 *   - onResend: async () => Promise<void>    // caller does the actual /auth/otp/send call
 *   - cooldownSeconds: number (default 30)   // seconds to wait between resends
 *   - autostart: boolean (default true)      // start the timer immediately (assumes an OTP was just sent)
 */
export default function ResendOtpButton({ onResend, cooldownSeconds = 30, autostart = true, testId = "resend-otp-btn" }) {
  const [seconds, setSeconds] = useState(autostart ? cooldownSeconds : 0);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (seconds <= 0) return;
    timerRef.current = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [seconds]);

  const doResend = async () => {
    if (seconds > 0 || busy) return;
    setBusy(true);
    try {
      await onResend();
      setSeconds(cooldownSeconds);
      toast.success("OTP resent");
    } catch (err) {
      const detail = err?.response?.data?.detail || "Failed to resend OTP";
      toast.error(detail);
      // If rate-limited, respect the server's wait time
      const m = /wait (\d+)s/.exec(detail);
      if (m) setSeconds(parseInt(m[1], 10));
    } finally { setBusy(false); }
  };

  const canResend = seconds <= 0 && !busy;

  return (
    <button
      type="button"
      onClick={doResend}
      disabled={!canResend}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${canResend ? "text-[#65A30D] hover:text-[#4D7C0F]" : "text-[#94A3B8] cursor-not-allowed"}`}
      data-testid={testId}
    >
      <RefreshCw className={`w-3 h-3 ${busy ? "animate-spin" : ""}`}/>
      {busy ? "Sending…" : canResend ? "Resend OTP" : `Resend in ${seconds}s`}
    </button>
  );
}
