import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "gfh_custom_domain_banner_dismissed";

export function CustomDomainBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    const isLovableHost = host.endsWith(".lovableproject.com") || host.endsWith(".lovable.app");
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    setShow(isLovableHost && !dismissed);
  }, []);

  if (!show) return null;

  return (
    <div className="border-b border-yellow-300 bg-yellow-50 text-yellow-900">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-6 py-3 text-sm">
        <div>
          <strong>Connect a custom domain before going live</strong> — Settings → Custom Domain.
          Your Stripe webhook must point to a stable URL.
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setShow(false);
          }}
          className="shrink-0 rounded p-1 hover:bg-yellow-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}