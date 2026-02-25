import { useState, useCallback } from "react";

/**
 * Hook to toggle privacy mode — masks sensitive data like phones, values, emails.
 */
export function usePrivacyMode(defaultHidden = false) {
  const [hidden, setHidden] = useState(defaultHidden);
  const toggle = useCallback(() => setHidden((h) => !h), []);

  const mask = useCallback(
    (value: string | null | undefined, type: "phone" | "value" | "email" | "text" = "text") => {
      if (!value) return "-";
      if (!hidden) return value;
      switch (type) {
        case "phone":
          return value.replace(/\d(?=\d{2})/g, "•");
        case "value":
          return "R$ •••";
        case "email": {
          const [local, domain] = value.split("@");
          if (!domain) return "•••";
          return `${local[0]}${"•".repeat(Math.max(local.length - 1, 2))}@${domain}`;
        }
        default:
          return "•".repeat(Math.min(value.length, 8));
      }
    },
    [hidden]
  );

  return { hidden, toggle, mask };
}
