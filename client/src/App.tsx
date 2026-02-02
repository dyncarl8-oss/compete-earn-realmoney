import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Route, Switch, useLocation } from "wouter";
import GameLobby from "@/pages/game-lobby";
import GameRoom from "@/pages/game-room";
import MatchHistory from "@/pages/match-history";
import GameResultsRouter from "@/pages/game-results-router";
import YahtzeeLobby from "@/pages/yahtzee-lobby";
import ChessLobby from "@/pages/chess-lobby";
import Dashboard from "@/pages/dashboard";
import TournamentDashboard from "@/pages/tournaments";
import TournamentWaitingRoom from "@/pages/tournament-waiting-room";
import PlinkoGame from "@/components/plinko-game";
import DiceGame from "@/components/dice-game";
import SlotsGame from "@/components/slots-game";
import ChessGame from "@/components/chess-game";
import InvitationNotificationManager from "@/components/invitation-notification-manager";
import WelcomeBonusManager from "@/components/welcome-bonus-manager";
import TermsOfService from "@/pages/terms-of-service";
import PrivacyPolicy from "@/pages/privacy-policy";
import Footer from "@/components/footer";
import WelcomePopup from "@/components/welcome-popup";
import AccessGate from "@/components/access-gate";

function Router() {
  const [, setLocation] = useLocation();
  
  return (
    <Switch>
      <Route path="/" component={GameLobby} />
      <Route path="/game/:gameId">
        {({ gameId }) => <GameRoom gameId={gameId} />}
      </Route>
      <Route path="/yahtzee" component={YahtzeeLobby} />
      <Route path="/chess" component={ChessLobby} />
      <Route path="/chess/:gameId">
        {({ gameId }) => <ChessGame gameId={gameId} onBack={() => setLocation("/")} />}
      </Route>
      <Route path="/plinko">
        {() => <PlinkoGame onBack={() => setLocation("/")} />}
      </Route>
      <Route path="/dice">
        {() => <DiceGame onBack={() => setLocation("/")} />}
      </Route>
      <Route path="/slots">
        {() => <SlotsGame onBack={() => setLocation("/")} />}
      </Route>
      <Route path="/match-history">
        <MatchHistory />
      </Route>
      <Route path="/results/:gameId">
        {({ gameId }) => <GameResultsRouter gameId={gameId} />}
      </Route>
      <Route path="/dashboard/:companyId" component={Dashboard} />
      <Route path="/tournaments/:companyId" component={TournamentDashboard} />
      <Route path="/tournaments" component={TournamentDashboard} />
      <Route path="/tournament/:id/waiting" component={TournamentWaitingRoom} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route>
        {/* 404 fallback - redirect to lobby */}
        <GameLobby />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <InvitationNotificationManager />
          <WelcomeBonusManager />
          <WelcomePopup />
          <AccessGate>
            <div className="min-h-screen flex flex-col">
              <Router />
              <Footer />
            </div>
          </AccessGate>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
