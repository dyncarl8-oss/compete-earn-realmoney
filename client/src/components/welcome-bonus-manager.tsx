import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import WelcomeBonusModal from "@/components/welcome-bonus-modal";
import { useWhopUser } from "@/hooks/use-whop-user";

export default function WelcomeBonusManager() {
  const { user, isLoading: isUserLoading } = useWhopUser();
  const [showModal, setShowModal] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Check if user is eligible for welcome bonus
  const { data: eligibilityData, isLoading: isCheckingEligibility } = useQuery({
    queryKey: [`/api/user/${user?.id}/welcome-bonus-eligible`],
    enabled: !!user?.id && !hasChecked,
    retry: false,
  });

  useEffect(() => {
    if (!isUserLoading && !isCheckingEligibility && user?.id && eligibilityData && !hasChecked) {
      if (eligibilityData.eligible) {
        // Small delay to let the app load before showing modal
        setTimeout(() => {
          setShowModal(true);
          setHasChecked(true);
        }, 1000);
      } else {
        setHasChecked(true);
      }
    }
  }, [user, eligibilityData, isUserLoading, isCheckingEligibility, hasChecked]);

  if (!user?.id) {
    return null;
  }

  return (
    <WelcomeBonusModal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      userId={user.id}
    />
  );
}
