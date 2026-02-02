import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AccessCheckParams {
  companyId?: string | null;
  experienceId?: string | null;
}

interface AccessCheckResult {
  has_access: boolean;
  access_level: "admin" | "customer" | "no_access";
  resourceId: string;
  userId: string;
}

export function useAccessCheck({ companyId, experienceId }: AccessCheckParams) {
  const enabled = !!(companyId || experienceId);

  const { data, isLoading, error } = useQuery<AccessCheckResult>({
    queryKey: ['/api/whop/check-access', companyId, experienceId],
    queryFn: async () => {
      console.log(`🔍 Client: Checking access for resource`, { companyId, experienceId });

      const response = await apiRequest('POST', '/api/whop/check-access', { companyId, experienceId });
      const result = await response.json();

      console.log(`✅ Client: Access check result`, {
        access_level: result.access_level,
        has_access: result.has_access,
        isAdmin: result.access_level === 'admin',
        isMember: result.access_level === 'customer',
      });

      return result;
    },
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    access: data,
    isLoading,
    error,
    isAdmin: data?.access_level === "admin",
    isMember: data?.access_level === "customer",
    hasAccess: data?.has_access ?? false,
  };
}
