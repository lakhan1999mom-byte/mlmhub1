/**
 * Firebase Client SDK — phone OTP auth.
 * Initializes once and exposes helpers for signInWithPhoneNumber.
 */
import { initializeApp, getApps } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

export function getFirebaseApp() {
  return getApps()[0] || initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

let _recaptcha = null;

/** Setup an invisible reCAPTCHA verifier attached to the given DOM container id. */
export function setupRecaptcha(containerId = "firebase-recaptcha") {
  const auth = getFirebaseAuth();
  // Reuse if already created
  if (_recaptcha) return _recaptcha;
  _recaptcha = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {},
  });
  return _recaptcha;
}

/**
 * Only try Firebase Phone Auth on production domains. On the preview / localhost the
 * domain isn't in Firebase's Authorized Domains, which forces a visible reCAPTCHA
 * challenge (bicycles/traffic lights) that hijacks the UI and traps the user on
 * step 1. On preview we short-circuit → the caller falls back to the dev-OTP path.
 */
const FIREBASE_ALLOWED_HOSTS = (
  process.env.REACT_APP_FIREBASE_HOSTS || "evergroemart.com,www.evergroemart.com"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function isFirebaseHostAllowed() {
  if (typeof window === "undefined") return false;
  return FIREBASE_ALLOWED_HOSTS.includes(window.location.hostname);
}

/** Send OTP via Firebase Phone Auth. Returns confirmationResult with .confirm(code) method. */
export async function sendFirebaseOtp(phoneE164) {
  if (!isFirebaseHostAllowed()) {
    // Force caller to use dev-OTP fallback on non-production hosts
    throw new Error("Firebase disabled on this host — using dev-OTP fallback");
  }
  const auth = getFirebaseAuth();
  const verifier = setupRecaptcha();
  return signInWithPhoneNumber(auth, phoneE164, verifier);
}

/** Convert a 10-digit Indian mobile to +91xxxxxxxxxx. */
export function toIndianE164(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return "+" + digits;
  if (digits.length === 10) return "+91" + digits;
  return "+" + digits;
}
