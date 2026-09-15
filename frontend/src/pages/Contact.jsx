import { useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const submit = (e) => {
    e.preventDefault();
    toast.success("Message received! We'll get back within 24 hours.");
    setForm({ name: "", email: "", message: "" });
  };
  return (
    <div className="max-w-5xl mx-auto px-6 py-12" data-testid="contact-page">
      <h1 className="font-display text-5xl font-bold mb-8">Get in Touch</h1>
      <div className="grid lg:grid-cols-2 gap-10">
        <form onSubmit={submit} className="card-soft p-8 space-y-4">
          <input className="input-soft" placeholder="Your Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required/>
          <input className="input-soft" type="email" placeholder="Your Email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required/>
          <textarea className="input-soft min-h-[140px]" placeholder="Your Message" value={form.message} onChange={(e) => setForm({...form, message: e.target.value})} required/>
          <button className="btn-primary w-full justify-center" data-testid="contact-submit">Send Message</button>
        </form>
        <div className="space-y-4">
          <div className="card-soft p-6 flex items-start gap-3"><Mail className="w-6 h-6 text-[#DC2626]"/><div><div className="font-semibold">Email</div><div className="text-sm text-[#334155]">support@evergroemart.com</div></div></div>
          <div className="card-soft p-6 flex items-start gap-3"><Phone className="w-6 h-6 text-[#DC2626]"/><div><div className="font-semibold">Phone</div><div className="text-sm text-[#334155]">+91-9928525889</div></div></div>
          <div className="card-soft p-6 flex items-start gap-3"><MessageCircle className="w-6 h-6 text-[#DC2626]"/><div><div className="font-semibold">WhatsApp</div><div className="text-sm text-[#334155]">24x7 chat support</div></div></div>
          <div className="card-soft p-6 flex items-start gap-3"><MapPin className="w-6 h-6 text-[#DC2626]"/><div><div className="font-semibold">Address</div><div className="text-sm text-[#334155]">Mumbai, India</div></div></div>
        </div>
      </div>
    </div>
  );
}
