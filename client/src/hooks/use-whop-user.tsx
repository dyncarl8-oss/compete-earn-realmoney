import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { useWhopIframe } from "./use-whop-iframe";

export function useWhopUser() {
  const { isInWhopIframe, isLoading: iframeLoading } = useWhopIframe();
  
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/whop/user"],
    retry: false,
    enabled: isInWhopIframe, // Only run when in Whop iframe
  });

  // Debug logging to track query execution
  console.log("🔍 useWhopUser Debug:", {
    isInWhopIframe,
    iframeLoading,
    isLoading,
    hasUser: !!user,
    hasError: !!error,
    error: error?.message,
    userId: user?.id,
    username: user?.username,
    queryEnabled: isInWhopIframe && !iframeLoading
  });

  return {
    user,
    isLoading: iframeLoading || isLoading,
    error,
    isAuthenticated: !!user,
    isInWhopIframe,
  };
}