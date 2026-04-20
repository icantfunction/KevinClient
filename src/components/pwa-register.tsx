// Stage 10 PWA Register Purpose
"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration is best-effort for local/dev installs.
    });
  }, []);

  return null;
}
