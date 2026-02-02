import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAccessCheck } from "@/hooks/use-access-check";
import { Loader2 } from "lucide-react";

interface AccessGateProps {
  children: React.ReactNode;
}

export default function AccessGate({ children }: AccessGateProps) {
  const [, setLocation] = useLocation();
  const [resourceIds, setResourceIds] = useState<{
    companyId?: string;
    experienceId?: string;
  }>({});
  const [hasExtracted, setHasExtracted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pathParts = window.location.pathname.split('/').filter(Boolean);

    let extractedCompanyId: string | undefined;
    let extractedExperienceId: string | undefined;

    extractedCompanyId = params.get('companyId') || undefined;
    extractedExperienceId = params.get('experienceId') || undefined;

    if (!extractedCompanyId && !extractedExperienceId) {
      if ((pathParts[0] === 'dashboard' || pathParts[0] === 'tournaments') && pathParts[1]) {
        if (pathParts[1].startsWith('biz_')) {
          extractedCompanyId = pathParts[1];
        } else if (pathParts[1].startsWith('exp_')) {
          extractedExperienceId = pathParts[1];
        }
      } else if (pathParts[0] === 'experiences' && pathParts[1]?.startsWith('exp_')) {
        extractedExperienceId = pathParts[1];
      }
    }

    console.log(`🔍 AccessGate: Extracted resource IDs`, {
      companyId: extractedCompanyId,
      experienceId: extractedExperienceId,
      pathname: window.location.pathname,
      search: window.location.search,
    });

    setResourceIds({
      companyId: extractedCompanyId,
      experienceId: extractedExperienceId,
    });
    setHasExtracted(true);
  }, []);

  const { access, isLoading, isAdmin, isMember } = useAccessCheck({
    companyId: resourceIds.companyId,
    experienceId: resourceIds.experienceId,
  });

  useEffect(() => {
    if (!hasExtracted) return;

    const currentPath = window.location.pathname;

    if (!resourceIds.companyId && !resourceIds.experienceId) {
      console.log(`ℹ️ AccessGate: No resource IDs found - allowing access to current page`);
      return;
    }

    if (isLoading || !access) return;

    if (isAdmin) {
      console.log(`👑 AccessGate: User is ADMIN - checking if redirect needed`);
      if (!currentPath.includes('/tournaments') && !currentPath.includes('/dashboard')) {
        console.log(`🔄 AccessGate: Redirecting ADMIN to tournaments`);
        const resourceId = resourceIds.companyId || resourceIds.experienceId;
        setLocation(`/tournaments/${resourceId}`);
      }
    } else if (isMember) {
      console.log(`👤 AccessGate: User is MEMBER - checking if redirect needed`);
      if (currentPath.includes('/tournaments') || currentPath.includes('/dashboard')) {
        console.log(`🔄 AccessGate: Redirecting MEMBER to game lobby`);
        setLocation('/');
      }
    } else {
      console.log(`❌ AccessGate: User has NO ACCESS`);
    }
  }, [access, isLoading, isAdmin, isMember, hasExtracted, setLocation, resourceIds]);

  if (!hasExtracted || ((resourceIds.companyId || resourceIds.experienceId) && isLoading)) {
    console.log("🔒 AccessGate: Loading State Debug", {
      hasExtracted,
      resourceIds,
      isLoading,
      companyId: resourceIds.companyId,
      experienceId: resourceIds.experienceId
    });

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-400">Verifying access...</p>
          {/* Debug info for development */}
          {import.meta.env.DEV && (
            <div className="text-xs text-gray-600 font-mono mt-4 max-w-lg text-left bg-black/20 p-4 rounded">
              <p>Debug Info:</p>
              <p>Has Extracted: {String(hasExtracted)}</p>
              <p>Is Loading: {String(isLoading)}</p>
              <p>Company ID: {String(resourceIds.companyId)}</p>
              <p>Experience ID: {String(resourceIds.experienceId)}</p>
              <p>Environment: {import.meta.env.MODE}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
