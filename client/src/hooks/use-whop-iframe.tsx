import { useState, useEffect } from "react";
import { createSdk } from "@whop/iframe";

export function useWhopIframe() {
  const [iframeSdk, setIframeSdk] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInWhopIframe, setIsInWhopIframe] = useState(false);

  useEffect(() => {
    const initializeIframeSdk = async () => {
      try {
        console.log("🔄 Initializing Whop iframe SDK...");
        
        // Check if we're in an iframe first
        const inIframe = window !== window.top;
        console.log("📱 In iframe:", inIframe);
        
        const appId = import.meta.env.VITE_WHOP_APP_ID || import.meta.env.NEXT_PUBLIC_WHOP_APP_ID;
        if (!appId) {
          console.warn("⚠️ VITE_WHOP_APP_ID or NEXT_PUBLIC_WHOP_APP_ID not found");
          setIsLoading(false);
          return;
        }

        // Create the Whop iframe SDK instance (official method)
        const sdk = createSdk({
          appId: appId,
        });

        console.log("✅ Whop iframe SDK created:", !!sdk);
        setIframeSdk(sdk);
        setIsInWhopIframe(inIframe);
        setIsLoading(false);
      } catch (error) {
        console.error("❌ Failed to initialize Whop iframe SDK:", error);
        setIframeSdk(null);
        setIsInWhopIframe(false);
        setIsLoading(false);
      }
    };

    initializeIframeSdk();
  }, []);

  return {
    iframeSdk,
    isLoading,
    isAvailable: !!iframeSdk,
    isInWhopIframe,
  };
}