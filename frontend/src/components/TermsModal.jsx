import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ScrollText } from "lucide-react";
import api from "@/lib/api";

/**
 * Reusable Terms & Conditions modal.
 * Props:
 *   - open: boolean
 *   - onClose: () => void
 *   - onAccept: () => void   (called when user clicks Accept — tick the checkbox in parent)
 */
export default function TermsModal({ open, onClose, onAccept }) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get("/site/settings")
      .then(({ data }) => setHtml(data.terms_content || "<p>No terms configured. Please contact support.</p>"))
      .catch(() => setHtml("<p>Failed to load terms. Please try again.</p>"))
      .finally(() => setLoading(false));
  }, [open]);

  const onScroll = (e) => {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) setScrolledToBottom(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
          data-testid="terms-modal"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#ECFCCB] flex items-center justify-center">
                  <ScrollText className="w-5 h-5 text-[#65A30D]"/>
                </div>
                <div>
                  <h2 className="font-display font-black text-xl text-[#064E3B] leading-tight">Terms & Conditions</h2>
                  <p className="text-xs text-[#64748B]">Please read carefully before accepting.</p>
                </div>
              </div>
              <button onClick={onClose} className="text-[#94A3B8] hover:text-[#334155] p-1" data-testid="terms-modal-close">
                <X className="w-5 h-5"/>
              </button>
            </div>

            {/* Content */}
            <div
              className="flex-1 overflow-y-auto p-5 prose prose-sm max-w-none prose-headings:font-display prose-headings:text-[#064E3B] prose-h2:text-2xl prose-h3:text-lg prose-p:text-[#334155] prose-li:text-[#334155] prose-strong:text-[#064E3B]"
              onScroll={onScroll}
              data-testid="terms-modal-content"
            >
              {loading ? (
                <div className="text-center py-12 text-[#64748B]">Loading terms…</div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: html }}/>
              )}
              {!scrolledToBottom && !loading && (
                <div className="text-xs text-[#94A3B8] text-center py-2 sticky bottom-0 bg-gradient-to-t from-white to-transparent">
                  ↓ Scroll to read all
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E2E8F0] flex gap-2 bg-[#F8FAFC]">
              <button onClick={onClose} className="btn-outline flex-1 justify-center" data-testid="terms-decline-btn">
                Cancel
              </button>
              <button
                onClick={() => { onAccept(); onClose(); }}
                className="btn-primary flex-1 justify-center"
                data-testid="terms-accept-btn"
              >
                <Check className="w-4 h-4"/> I Accept
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
