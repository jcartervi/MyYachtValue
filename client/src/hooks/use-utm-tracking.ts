import { useEffect, useState } from "react";

export function useUTMTracking() {
  const [utmParams, setUtmParams] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const params: Record<string, string> = {};

      // Capture UTM parameters
      const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
      utmKeys.forEach(key => {
        const value = urlParams.get(key);
        if (value) {
          params[key] = value;
        }
      });

      // Also capture referrer information
      if (document.referrer) {
        params.referrer = document.referrer;
      }

      // Store in localStorage for persistence across page reloads
      if (Object.keys(params).length > 0) {
        try {
          localStorage.setItem("utm_params", JSON.stringify(params));
        } catch (error) {
          console.warn("Failed to store UTM parameters:", error);
        }
      } else {
        // Try to load from localStorage if no UTM params in URL
        try {
          const stored = localStorage.getItem("utm_params");
          if (stored) {
            Object.assign(params, JSON.parse(stored));
          }
        } catch (error) {
          console.warn("Failed to load UTM parameters:", error);
        }
      }

      setUtmParams(params);
    }
  }, []);

  return utmParams;
}
