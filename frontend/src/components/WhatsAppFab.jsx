import { MessageCircle } from "lucide-react";

export default function WhatsAppFab({ phone = "+919876543210" }) {
  const link = `https://wa.me/${(phone || "").replace(/[^0-9]/g, "")}`;
  return (
    <a href={link} target="_blank" rel="noreferrer" className="fab-whatsapp" data-testid="whatsapp-fab" aria-label="WhatsApp">
      <MessageCircle className="w-6 h-6" />
    </a>
  );
}
