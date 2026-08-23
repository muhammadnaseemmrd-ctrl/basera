import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

// Pakistani users expect WhatsApp as a direct contact channel. VITE_SUPPORT_WHATSAPP lets
// the owner point this at a real number without a code change; the fallback below is a
// clearly-placeholder Pakistani mobile number (923XXXXXXXXX format, no leading +/0).
const FALLBACK_WHATSAPP_NUMBER = "923001234567";
const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP || FALLBACK_WHATSAPP_NUMBER).replace(/[^\d]/g, "");
const PREFILLED_MESSAGE = "Hi Basera, I have a question about finding a hostel.";

export function WhatsAppButton() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const chatUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(PREFILLED_MESSAGE)}`;

  return (
    <div className="fixed bottom-24 right-5 z-30 md:bottom-8 md:right-8">
      <div className="relative">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss WhatsApp chat button"
          className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-line bg-surface text-neutral-500 shadow-card transition duration-250 ease-smooth hover:text-ink"
        >
          <X size={13} />
        </button>
        <a
          href={chatUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with Basera on WhatsApp"
          className="grid h-14 w-14 place-items-center rounded-full bg-primary-600 text-white shadow-soft outline-none transition duration-250 ease-smooth hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-float active:translate-y-0 focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
        >
          <MessageCircle size={26} />
        </a>
      </div>
    </div>
  );
}
