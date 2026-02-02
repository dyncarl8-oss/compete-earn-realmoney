import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Tournament {
  id: string;
  gameType: string;
  hostedBy: string;
  companyId?: string;
  experienceId?: string;
  potAmount: string;
  entryFee: string;
  maxParticipants: number;
  currentParticipants: number;
  status: string;
  name: string;
  description?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  isParticipant?: boolean;
  gameId?: string;
}

interface CreateTournamentParams {
  gameType: string;
  name: string;
  description?: string;
  potAmount: string;
  entryFee: string;
  maxParticipants: number;
  companyId?: string;
  experienceId?: string;
}

interface UpdateTournamentStatusParams {
  tournamentId: string;
  status: string;
  companyId?: string;
  experienceId?: string;
}

async function apiRequest(method: string, url: string, body?: any) {
  const userToken = sessionStorage.getItem('whop_user_token') || localStorage.getItem('whop_user_token');
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-whop-user-token': userToken || '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export function useTournaments() {
  return useQuery<Tournament[]>({
    queryKey: ['/api/tournaments'],
    queryFn: () => apiRequest('GET', '/api/tournaments'),
    refetchInterval: 10000,
  });
}

export function useActiveTournaments() {
  return useQuery<Tournament[]>({
    queryKey: ['/api/tournaments/active'],
    queryFn: () => apiRequest('GET', '/api/tournaments/active'),
    refetchInterval: 8000,
  });
}

export function useCreateTournament() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateTournamentParams) => 
      apiRequest('POST', '/api/tournaments', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments/active'] });
      toast({
        title: "Tournament Created",
        description: "The tournament has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Tournament",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateTournamentStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tournamentId, status, companyId, experienceId }: UpdateTournamentStatusParams) => 
      apiRequest('PUT', `/api/tournaments/${tournamentId}/status`, { status, companyId, experienceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments/active'] });
      toast({
        title: "Tournament Updated",
        description: "The tournament status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Tournament",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUserActiveTournaments(userId: string | undefined) {
  return useQuery<Tournament[]>({
    queryKey: [`/api/user/${userId}/active-tournaments`],
    queryFn: () => apiRequest('GET', `/api/user/${userId}/active-tournaments`),
    enabled: !!userId,
    refetchInterval: 5000,
  });
}

export function useStartTournament() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tournamentId, companyId, experienceId }: { tournamentId: string; companyId?: string; experienceId?: string }) => 
      apiRequest('PUT', `/api/tournaments/${tournamentId}/status`, { status: 'started', companyId, experienceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments/active'] });
      toast({
        title: "Tournament Started",
        description: "The tournament has been started and the game has been created.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Start Tournament",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useNotifyTournamentMembers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tournamentId: string) => 
      apiRequest('POST', `/api/tournaments/${tournamentId}/notify`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments/active'] });
      toast({
        title: "Notifications Sent",
        description: "All company team members have been notified about the tournament.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send Notifications",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
