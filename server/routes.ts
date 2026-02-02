import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGameSchema, insertTransactionSchema, insertTournamentSchema, YAHTZEE_CATEGORIES, YAHTZEE_FIXED_SCORES, type YahtzeeCategory, type ChessPieceType } from "@shared/schema";
import { makeAIDecision, getAvailableCategories } from "./ai-logic";
import {
  initializeChessBoard,
  validateMove,
  squareToPosition,
  positionToSquare,
  getMoveNotation,
  getEnPassantTarget,
  updateCastlingRights
} from "./chess-logic";
import { requireWhopAuth, requireAdminAuth, type WhopUser } from "./whop-auth";
import { whopSdk, validateWebhook } from "./whop-sdk";
import { setupWebSocket, getWebSocketServer } from "./websocket";
import { payWinner, processCommission } from "./whop-payouts";
import { logger } from "./logger";
import { randomUUID } from "crypto";
import { sendWithdrawalNotification, sendDepositNotification, sendPaymentAttemptNotification } from "./email-service";
import { generateAndSendReport } from "./report-scheduler";

export async function registerRoutes(app: Express): Promise<Server> {
  // Whop-specific routes
  app.get("/api/whop/user", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      // Get real Whop user data including profile image
      const whopUserData = await whopSdk.users.getUser({ userId: whopUser.id });
      
      let user = await storage.getUser(whopUser.id);
      
      // Create or get user with Whop user ID as the primary key
      user = await storage.createOrGetUser(whopUser.id, {
        username: whopUserData.username || `Player${whopUser.id.slice(-4)}`,
        email: whopUserData.name || "",
        profileImageUrl: whopUserData.profilePicture?.sourceUrl || null,
      });
      
      res.json(user);
    } catch (error) {
      console.error("Failed to fetch Whop user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Whop access validation endpoint
  app.post("/api/whop/validate-access", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const { experienceId } = req.body;
      
      if (!experienceId) {
        return res.status(400).json({ error: "Experience ID is required" });
      }
      
      // Use Whop SDK to validate access
      const result = await whopSdk.access.checkIfUserHasAccessToExperience({
        userId: whopUser.id,
        experienceId,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Access validation error:", error);
      res.status(500).json({ error: "Failed to validate access" });
    }
  });

  // Check access level (admin vs member) with logging
  app.post("/api/whop/check-access", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const { companyId, experienceId } = req.body;
      
      // Require at least one resource identifier
      if (!companyId && !experienceId) {
        return res.status(400).json({ 
          error: "Either companyId or experienceId is required" 
        });
      }
      
      // Use the provided resource ID (prefer companyId for dashboard view)
      const resourceId = companyId || experienceId;
      
      console.log(`🔍 Checking access for user ${whopUser.id} to resource ${resourceId}`);
      
      let result: { has_access: boolean; access_level: "admin" | "customer" | "no_access" };
      
      // SDK v0.0.48 doesn't have checkAccess method, so use alternative approach
      if (companyId) {
        // Check if user is an authorized user (admin/owner) of the company
        try {
          const response = await whopSdk.companies.listAuthorizedUsers({
            companyId: companyId,
          });
          
          // Check if user is in the authorized users list
          const authUsers = response?.authorizedUsers || [];
          const userAuth = authUsers.find((authUser: any) => authUser.userId === whopUser.id);
          const isAdmin = !!userAuth;
          
          // Log the user's role if they are an authorized user
          if (userAuth) {
            console.log(`👤 User role: ${userAuth.role}`);
          }
          
          result = {
            has_access: isAdmin,
            access_level: isAdmin ? "admin" : "no_access"
          };
        } catch (error) {
          console.error("Error checking authorized users:", error);
          result = {
            has_access: false,
            access_level: "no_access"
          };
        }
      } else {
        // For experience, check user's access level (includes admin/customer/no_access)
        try {
          const accessResult = await whopSdk.access.checkIfUserHasAccessToExperience({
            userId: whopUser.id,
            experienceId: experienceId!,
          });
          
          // The SDK returns hasAccess boolean and accessLevel enum
          // accessLevel can be "admin", "customer", or "no_access"
          const mappedAccessLevel = accessResult.accessLevel === "admin" ? "admin" 
            : accessResult.accessLevel === "customer" ? "customer" 
            : "no_access";
          
          console.log(`👤 User access level from SDK: ${accessResult.accessLevel}`);
          
          result = {
            has_access: accessResult.hasAccess,
            access_level: mappedAccessLevel
          };
        } catch (error) {
          console.error("Error checking experience access:", error);
          result = {
            has_access: false,
            access_level: "no_access"
          };
        }
      }
      
      // Log the access level with clear indication of admin vs member
      if (result.access_level === "admin") {
        console.log(`✅ ADMIN ACCESS: User ${whopUser.id} is an ADMIN of ${resourceId}`);
      } else if (result.access_level === "customer") {
        console.log(`✅ MEMBER ACCESS: User ${whopUser.id} is a MEMBER of ${resourceId}`);
      } else {
        console.log(`❌ NO ACCESS: User ${whopUser.id} has no access to ${resourceId}`);
      }
      
      res.json({
        ...result,
        resourceId,
        userId: whopUser.id,
      });
    } catch (error) {
      console.error("❌ Access check error:", error);
      res.status(500).json({ error: "Failed to check access" });
    }
  });

  // User routes - secured with auth
  app.get("/api/user/:id", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      // Only allow users to access their own data
      if (req.params.id !== whopUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // DISABLED: Add funds endpoint removed for security
  // Users should only be able to add funds through verified Whop payments
  // app.post("/api/user/:id/add-funds", requireWhopAuth, async (req, res) => {
  //   // This endpoint was removed to prevent arbitrary balance inflation
  //   // Real money deposits should only come through verified payment providers
  // });

  // SECURITY FIXED: Atomic withdrawal request endpoint with race condition protection
  app.post("/api/user/:id/request-withdrawal", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      // Only allow users to withdraw from their own account
      if (req.params.id !== whopUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { amount } = req.body;
      
      // Input validation
      if (amount === undefined || amount === null) {
        return res.status(400).json({ message: "Withdrawal amount is required" });
      }

      // Additional input validation
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ message: "Withdrawal amount must be a valid number greater than 0" });
      }

      // Generate idempotency key for this specific withdrawal request
      const idempotencyKey = `withdrawal_${whopUser.id}_${amount}_${Date.now()}_${randomUUID()}`;
      
      // STEP 1: Process the atomic withdrawal first (validates and deducts balance)
      const result = await storage.atomicWithdrawal(whopUser.id, amount, idempotencyKey);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: result.error,
          availableForWithdrawal: result.availableForWithdrawal
        });
      }

      // STEP 2: Send email notification to admin AFTER successful withdrawal
      // Balance has been deducted, now notify admin for manual payout
      const emailSent = await sendWithdrawalNotification({
        userName: result.user!.username,
        userId: whopUser.id,
        amount: amount,
        userEmail: result.user!.email || undefined,
        transactionId: result.transaction!.id,
        timestamp: new Date().toISOString(),
      });

      if (!emailSent) {
        // CRITICAL: Email failed but balance was already deducted
        // Log this prominently so manual intervention can happen
        logger.error(`🚨 CRITICAL: Withdrawal processed but email notification failed!`, {
          userId: whopUser.id,
          amount: amount,
          transactionId: result.transaction!.id,
          userName: result.user!.username,
          userEmail: result.user!.email,
          timestamp: new Date().toISOString(),
        });
        
        // Still return success to user since their balance was deducted
        return res.json({
          success: true,
          message: "Withdrawal request processed but notification failed. Our team has been alerted and will process your request within 24-48 hours.",
          withdrawnAmount: amount,
          remainingBalance: result.user!.balance,
          availableForWithdrawal: result.availableForWithdrawal,
          user: result.user,
          transactionId: result.transaction!.id,
          status: "pending_manual_processing",
        });
      }

      logger.info(`📧 ✅ Withdrawal processed and email notification sent for user ${whopUser.id}, amount: $${amount}`);

      // Send real-time balance update via WebSocket
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.sendBalanceUpdate(whopUser.id);
      }

      res.json({
        success: true,
        message: "Withdrawal request received! Your request has been submitted for manual processing and will be handled within 24-48 hours.",
        withdrawnAmount: amount,
        remainingBalance: result.user!.balance,
        availableForWithdrawal: result.availableForWithdrawal,
        user: result.user,
        transactionId: result.transaction!.id,
        status: "pending_manual_processing",
      });
    } catch (error) {
      logger.error("Withdrawal request error:", error);
      res.status(500).json({ message: "Failed to process withdrawal request" });
    }
  });

  // Get user withdrawal history
  app.get("/api/user/:id/withdrawals", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      // Only allow users to access their own withdrawal history
      if (req.params.id !== whopUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const transactions = await storage.getUserTransactions(req.params.id);
      const withdrawals = transactions.filter(t => t.type === "withdrawal");
      
      res.json(withdrawals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch withdrawal history" });
    }
  });

  // Bug report submission - Optional auth (can be submitted by anyone)
  app.post("/api/bug-reports", async (req, res) => {
    try {
      const { title, description, page } = req.body;
      
      if (!title || !description || !page) {
        return res.status(400).json({ message: "Title, description, and page are required" });
      }
      
      // Try to get user ID if authenticated, but don't require it
      let userId: string | null = null;
      try {
        const whopUser = (req as any).whopUser as WhopUser | undefined;
        if (whopUser) {
          userId = whopUser.id;
        }
      } catch (error) {
        // User not authenticated, that's fine
      }
      
      const bugReport = await storage.createBugReport({
        userId,
        title,
        description,
        page,
      });
      
      res.json(bugReport);
    } catch (error) {
      console.error("Failed to create bug report:", error);
      res.status(500).json({ message: "Failed to submit bug report" });
    }
  });

  // Track page view - No auth required (tracks all visitors)
  app.post("/api/analytics/page-view", async (req, res) => {
    try {
      const { pagePath } = req.body;
      
      if (!pagePath) {
        return res.status(400).json({ message: "Page path is required" });
      }

      // Try to get user ID if authenticated (optional)
      let userId: string | null = null;
      try {
        const whopUser = (req as any).whopUser as WhopUser;
        if (whopUser?.id) {
          userId = whopUser.id;
        }
      } catch {
        // User not authenticated, continue with null userId
      }

      // Get user agent and IP address for analytics
      const userAgent = req.headers['user-agent'] || null;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || null;

      await storage.createPageView({
        pagePath,
        userId,
        userAgent,
        ipAddress,
      });

      res.json({ success: true });
    } catch (error) {
      logger.error("Page view tracking error:", error);
      res.status(500).json({ message: "Failed to track page view" });
    }
  });

  // Get online players endpoint
  app.get("/api/players/online", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      // Get all users who have been active recently (within last 5 minutes)
      const onlineThreshold = new Date(Date.now() - 5 * 60 * 1000);
      const allUsers = await storage.getAllUsers();
      
      // Filter users based on activity and exclude the current user
      const onlinePlayers = allUsers
        .filter((user: any) => 
          user.id !== whopUser.id && // Don't include self
          user.lastActivity && new Date(user.lastActivity) > onlineThreshold
        )
        .map((user: any) => {
          // Determine online status based on activity and current game status
          let status: "online" | "in-game" | "away" = "online";
          
          // Check if player is currently in a game by checking if they have an active game
          const hasActiveGame = false; // We'll enhance this later with proper active game tracking
          if (hasActiveGame) {
            status = "in-game";
          } else {
            // Check how recently they were active
            const lastActivity = new Date(user.lastActivity || 0);
            const minutesInactive = (Date.now() - lastActivity.getTime()) / (1000 * 60);
            if (minutesInactive > 2) {
              status = "away";
            }
          }
          
          return {
            id: user.id,
            username: user.username,
            profileImageUrl: user.profileImageUrl || `https://images.unsplash.com/photo-${Math.random() > 0.5 ? '1535713875002-d1d0cf377fde' : '1494790108755-2616b612b786'}?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=60&h=60`,
            status,
            lastSeen: user.lastActivity?.toISOString() || new Date().toISOString()
          };
        })
        .sort((a: any, b: any) => {
          // Sort by status priority (online first, then in-game, then away)
          const statusPriority: { [key: string]: number } = { online: 0, "in-game": 1, away: 2 };
          return statusPriority[a.status] - statusPriority[b.status];
        });

      res.json(onlinePlayers);
    } catch (error) {
      console.error("Failed to fetch online players:", error);
      res.status(500).json({ message: "Failed to fetch online players" });
    }
  });

  // Send game invitation endpoint - ENHANCED with real invitation system
  app.post("/api/games/invite", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const { gameId, playerId, message } = req.body;

      // Validate request
      if (!gameId || !playerId) {
        return res.status(400).json({ message: "Game ID and Player ID are required" });
      }

      // Verify game exists and is in a joinable state
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      if (game.status !== "open" && game.status !== "filling") {
        return res.status(400).json({ message: "Game is not accepting new players" });
      }

      // Verify player exists
      const targetPlayer = await storage.getUser(playerId);
      if (!targetPlayer) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Check if inviter is in the game
      const participants = await storage.getGameParticipants(gameId);
      const inviterInGame = participants.some(p => p.userId === whopUser.id);
      if (!inviterInGame) {
        return res.status(403).json({ message: "Only game participants can send invitations" });
      }

      // Check if target player is already in a game
      const activeGame = await storage.getUserActiveGame(playerId);
      if (activeGame) {
        return res.status(400).json({ message: "Player is already in a game" });
      }

      // Check if there's already a pending invitation for this game and player
      const existingInvitations = await storage.getUserInvitations(playerId, "pending");
      const existingInvitation = existingInvitations.find(inv => inv.gameId === gameId);
      if (existingInvitation) {
        return res.status(400).json({ message: "Player already has a pending invitation for this game" });
      }

      // Create invitation with expiration (30 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      const invitation = await storage.createGameInvitation({
        gameId,
        fromUserId: whopUser.id,
        toUserId: playerId,
        message: message || `Join me in ${game.name}! 🎲`,
        expiresAt,
        status: "pending"
      });

      // Send real-time notification via WebSocket
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.sendInvitationNotification(playerId, invitation);
      }

      res.json({ 
        success: true, 
        message: "Invitation sent successfully",
        targetPlayer: targetPlayer.username,
        invitationId: invitation.id
      });
    } catch (error) {
      console.error("Failed to send invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Get user's invitations endpoint
  app.get("/api/invitations", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const { status } = req.query;

      // Clean up expired invitations first
      await storage.expireOldInvitations();

      // Get user's invitations
      const invitations = await storage.getUserInvitations(
        whopUser.id, 
        status as string
      );

      // Enrich invitations with game and sender information
      const enrichedInvitations = await Promise.all(
        invitations.map(async (invitation) => {
          const game = await storage.getGame(invitation.gameId);
          const sender = await storage.getUser(invitation.fromUserId);
          
          return {
            ...invitation,
            game: game ? {
              id: game.id,
              name: game.name,
              entryFee: game.entryFee,
              maxPlayers: game.maxPlayers,
              currentPlayers: game.currentPlayers,
              status: game.status
            } : null,
            sender: sender ? {
              id: sender.id,
              username: sender.username,
              profileImageUrl: sender.profileImageUrl,
            } : null,
          };
        })
      );

      res.json(enrichedInvitations);
    } catch (error) {
      console.error("Failed to fetch invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Accept invitation endpoint
  app.post("/api/invitations/:id/accept", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const invitationId = req.params.id;

      // Get the invitation
      const invitation = await storage.getGameInvitation(invitationId);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Verify invitation belongs to user
      if (invitation.toUserId !== whopUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if invitation is still pending
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Invitation is no longer pending" });
      }

      // Check if invitation has expired
      if (invitation.expiresAt < new Date()) {
        await storage.updateInvitationStatus(invitationId, "expired");
        return res.status(400).json({ message: "Invitation has expired" });
      }

      // Get the game to join
      const game = await storage.getGame(invitation.gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Check if game is still accepting players
      if (game.status !== "open" && game.status !== "filling") {
        await storage.updateInvitationStatus(invitationId, "expired");
        return res.status(400).json({ message: "Game is no longer accepting players" });
      }

      if (game.currentPlayers >= game.maxPlayers) {
        await storage.updateInvitationStatus(invitationId, "expired");
        return res.status(400).json({ message: "Game is full" });
      }

      // Check if user is already in a game
      const activeGame = await storage.getUserActiveGame(whopUser.id);
      if (activeGame) {
        return res.status(400).json({ message: "You are already in a game" });
      }

      // Get user to verify balance
      const user = await storage.getUser(whopUser.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (parseFloat(user.balance) < parseFloat(game.entryFee)) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Accept the invitation and join the game
      await storage.updateInvitationStatus(invitationId, "accepted");

      // Join the game (reuse existing game joining logic)
      const newBalance = (parseFloat(user.balance) - parseFloat(game.entryFee)).toFixed(2);
      await storage.updateUserBalance(whopUser.id, newBalance);
      await storage.addGameParticipant(invitation.gameId, whopUser.id);

      const newPlayerCount = game.currentPlayers + 1;
      await storage.updateGamePlayers(invitation.gameId, newPlayerCount);

      // Create transaction
      await storage.createTransaction({
        userId: whopUser.id,
        type: "entry",
        amount: `-${game.entryFee}`,
        description: `${game.name} - Entry Fee (via invitation)`,
        gameId: invitation.gameId,
        balanceAfter: newBalance,
      });

      // Update user stats
      await storage.updateUserStats(whopUser.id, user.gamesPlayed + 1, user.gamesWon, user.totalWinnings);

      // Check if game should start
      const updatedGame = await storage.getGame(invitation.gameId);
      if (updatedGame && updatedGame.currentPlayers >= updatedGame.maxPlayers) {
        // Game is full - implement game start logic here if needed
        await storage.updateGameStatus(invitation.gameId, "running");
      } else if (updatedGame && updatedGame.currentPlayers === 1) {
        await storage.updateGameStatus(invitation.gameId, "filling");
      }

      // Broadcast game update
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastGameUpdate(invitation.gameId);
      }

      res.json({ 
        success: true, 
        message: "Invitation accepted and joined game successfully",
        gameId: invitation.gameId
      });
    } catch (error) {
      console.error("Failed to accept invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Decline invitation endpoint
  app.post("/api/invitations/:id/decline", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const invitationId = req.params.id;

      // Get the invitation
      const invitation = await storage.getGameInvitation(invitationId);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Verify invitation belongs to user
      if (invitation.toUserId !== whopUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if invitation is still pending
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Invitation is no longer pending" });
      }

      // Decline the invitation
      await storage.updateInvitationStatus(invitationId, "declined");

      res.json({ 
        success: true, 
        message: "Invitation declined successfully"
      });
    } catch (error) {
      console.error("Failed to decline invitation:", error);
      res.status(500).json({ message: "Failed to decline invitation" });
    }
  });

  // Game routes
  app.get("/api/games", async (req, res) => {
    try {
      const games = await storage.getAvailableGames();
      res.json(games);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  // Score category route - moved early to ensure registration
  app.post("/api/games/:id/score-category", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const { category } = req.body;
      
      if (!Object.values(YAHTZEE_CATEGORIES).includes(category as YahtzeeCategory)) {
        return res.status(400).json({ message: "Invalid scoring category" });
      }

      const game = await storage.getGame(req.params.id);
      if (!game || game.status !== "running") {
        return res.status(400).json({ message: "Game not running" });
      }

      if (game.currentTurnPlayerId !== whopUser.id) {
        return res.status(403).json({ message: "Not your turn" });
      }

      const currentTurn = await storage.getCurrentYahtzeeTurn(req.params.id, whopUser.id);
      const playerState = await storage.getYahtzeePlayerState(req.params.id, whopUser.id);
      
      if (!currentTurn || !playerState) {
        return res.status(404).json({ message: "Turn or player state not found" });
      }

      // Check if category already used (treat undefined as unused)
      const categoryValue = (playerState as any)[category] ?? -1;
      if (categoryValue !== -1) {
        return res.status(400).json({ message: "Category already used" });
      }

      // Calculate score for this category
      const dice = [
        currentTurn.dice1 || 1, 
        currentTurn.dice2 || 1, 
        currentTurn.dice3 || 1, 
        currentTurn.dice4 || 1, 
        currentTurn.dice5 || 1
      ];
      const score = calculateScore(dice, category as YahtzeeCategory);

      // Update player state with score and increment turns completed
      const stateUpdates: any = { 
        [category]: score,
        turnsCompleted: (playerState.turnsCompleted || 0) + 1
      };
      
      // Create a temporary state to calculate bonuses and total score
      const tempState = { ...playerState, ...stateUpdates };
      
      // Calculate upper section bonus if all upper section categories are complete
      const upperSectionCategories = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
      const upperSectionScores = upperSectionCategories.map(cat => tempState[cat] === -1 ? 0 : (tempState[cat] || 0));
      const upperSectionTotal = upperSectionScores.reduce((sum, score) => sum + score, 0);
      const allUpperSectionComplete = upperSectionCategories.every(cat => (tempState[cat] ?? -1) !== -1);
      
      // Automatically award upper section bonus if earned and all upper section categories are filled
      if (allUpperSectionComplete && upperSectionTotal >= 63 && !tempState.upperSectionBonus) {
        stateUpdates.upperSectionBonus = 35;
        tempState.upperSectionBonus = 35;
      }
      
      // Handle multiple Yahtzees - if player already has yahtzee and rolls another one
      if (category === 'yahtzee' && score === 50 && tempState.yahtzee && tempState.yahtzee > 0) {
        const currentYahtzeeBonus = tempState.yahtzeeBonus || 0;
        stateUpdates.yahtzeeBonus = currentYahtzeeBonus + 100;
        tempState.yahtzeeBonus = currentYahtzeeBonus + 100;
      }
      
      const totalScore = calculateTotalScore(tempState);
      stateUpdates.totalScore = totalScore;
      
      await storage.updateYahtzeePlayerState(req.params.id, whopUser.id, stateUpdates);
      
      // Complete the turn
      await storage.completeYahtzeeTurn(currentTurn.id, category, score);

      // Advance to next turn
      await advanceTurn(req.params.id);

      res.json({ message: "Category scored successfully", score });
    } catch (error) {
      console.error("Score category error:", error);
      res.status(500).json({ message: "Failed to score category" });
    }
  });

  app.get("/api/games/:id", async (req, res) => {
    try {
      const game = await storage.getGame(req.params.id);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json(game);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch game" });
    }
  });

  app.get("/api/games/:id/participants", async (req, res) => {
    try {
      const participants = await storage.getGameParticipants(req.params.id);
      const participantsWithUsers = await Promise.all(
        participants.map(async (p) => {
          const user = await storage.getUser(p.userId);
          return { ...p, user };
        })
      );
      res.json(participantsWithUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch participants" });
    }
  });

  app.post("/api/games", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      // Parse and validate game data
      const gameData = insertGameSchema.parse({
        name: req.body.name || `${req.body.gameType === 'chess' ? 'Chess' : 'Yahtzee'} Table`,
        gameType: req.body.gameType || "yahtzee",
        entryFee: req.body.entryFee || "2.00",
        maxPlayers: Math.min(Math.max(req.body.maxPlayers || (req.body.gameType === 'chess' ? 2 : 3), 2), 5), // Ensure 2-5 players
        totalRounds: req.body.totalRounds || 13, // Full Yahtzee game with 13 rounds
        gameMode: req.body.gameMode || "multiplayer",
        aiOpponents: req.body.aiOpponents || 0,
      });
      
      // Create the game
      const game = await storage.createGame(gameData);
      
      // For multiplayer games, automatically add the creator as the first participant
      if (gameData.gameMode === "multiplayer" || !gameData.gameMode) {
        // Get or create user profile
        let user = await storage.createOrGetUser(whopUser.id, {
          username: `Player${whopUser.id.slice(-4)}`,
          email: "",
          profileImageUrl: null,
        });
        
        // Check if user has sufficient balance
        if (parseFloat(user.balance) < parseFloat(game.entryFee)) {
          // Delete the game we just created since user can't afford to join
          await storage.updateGameStatus(game.id, "completed");
          return res.status(400).json({ message: "Insufficient balance to create and join this table" });
        }
        
        // Deduct entry fee
        const newBalance = (parseFloat(user.balance) - parseFloat(game.entryFee)).toFixed(2);
        await storage.updateUserBalance(whopUser.id, newBalance);
        
        // Add the creator as a participant
        await storage.addGameParticipant(game.id, whopUser.id);
        
        // Update game player count
        await storage.updateGamePlayers(game.id, 1);
        
        // Update game status to filling
        await storage.updateGameStatus(game.id, "filling");
        
        // Create transaction
        await storage.createTransaction({
          userId: whopUser.id,
          type: "entry",
          amount: `-${game.entryFee}`,
          description: `${game.name} - Entry Fee`,
          gameId: game.id,
          balanceAfter: newBalance,
        });
        
        // Update user stats
        await storage.updateUserStats(whopUser.id, user.gamesPlayed + 1, user.gamesWon, user.totalWinnings);
      }
      
      // For practice games with AI, automatically add the human player and AI opponents
      if (gameData.gameMode === "practice" && gameData.aiOpponents > 0) {
        // Get or create user profile
        let user = await storage.createOrGetUser(whopUser.id, {
          username: `Player${whopUser.id.slice(-4)}`,
          email: "",
          profileImageUrl: null,
        });
        
        // Add the human player to the game (no balance check for practice games)
        await storage.addGameParticipant(game.id, whopUser.id);
        
        // Add AI players to the game
        for (let i = 1; i <= gameData.aiOpponents; i++) {
          const aiPlayerId = `ai-${game.id}-${i}`;
          // Create AI user profiles
          await storage.createOrGetUser(aiPlayerId, {
            username: `AI Player ${i}`,
            email: "",
            profileImageUrl: null,
          });
          await storage.addGameParticipant(game.id, aiPlayerId);
        }
        
        // Update the game player count
        const totalPlayers = 1 + gameData.aiOpponents; // human + AI opponents
        await storage.updateGamePlayers(game.id, totalPlayers);
        
        // If game is now full, initialize it based on game type
        const updatedGame = await storage.getGame(game.id);
        if (updatedGame && updatedGame.currentPlayers >= updatedGame.maxPlayers) {
          if (updatedGame.gameType === "chess") {
            await initializeChessGame(game.id);
          } else {
            await initializeYahtzeeGame(game.id);
          }
        }
      }
      
      // Broadcast game creation/update to all connected clients
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastGameUpdate(game.id);
      }
      
      res.json(game);
    } catch (error) {
      console.error("Game creation error:", error);
      res.status(400).json({ message: "Invalid game data" });
    }
  });

  app.post("/api/games/:id/join", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const game = await storage.getGame(req.params.id);

      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      if (game.currentPlayers >= game.maxPlayers) {
        return res.status(400).json({ message: "Game is full" });
      }

      // Get or create user profile with Whop user ID
      let user = await storage.createOrGetUser(whopUser.id, {
        username: `Player${whopUser.id.slice(-4)}`,
        email: "",
        profileImageUrl: null,
      });

      if (parseFloat(user.balance) < parseFloat(game.entryFee)) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Check if user is already in a game
      const activeGame = await storage.getUserActiveGame(whopUser.id);
      if (activeGame) {
        return res.status(400).json({ message: "Already in a game" });
      }

      // Deduct entry fee
      const newBalance = (parseFloat(user.balance) - parseFloat(game.entryFee)).toFixed(2);
      await storage.updateUserBalance(whopUser.id, newBalance);

      // Add participant
      await storage.addGameParticipant(req.params.id, whopUser.id);
      logger.debug(`Join Game Debug: Added participant ${whopUser.id} to game ${req.params.id}`);

      // Update game player count
      const newPlayerCount = game.currentPlayers + 1;
      await storage.updateGamePlayers(req.params.id, newPlayerCount);

      // Create transaction
      await storage.createTransaction({
        userId: whopUser.id,
        type: "entry",
        amount: `-${game.entryFee}`,
        description: `${game.name} - Entry Fee`,
        gameId: req.params.id,
        balanceAfter: newBalance,
      });

      // Update user stats
      await storage.updateUserStats(whopUser.id, user.gamesPlayed + 1, user.gamesWon, user.totalWinnings);

      // Refetch game to get accurate current state for status decisions
      const currentGame = await storage.getGame(req.params.id);
      if (!currentGame) {
        return res.status(500).json({ message: "Failed to update game" });
      }

      // Update game status based on current player count
      if (currentGame.currentPlayers === 1) {
        // First player joined - change to filling status to show it's no longer empty
        await storage.updateGameStatus(req.params.id, "filling");
        logger.debug(`Join Game Debug: Updated game ${req.params.id} status to "filling" (${currentGame.currentPlayers}/${currentGame.maxPlayers} players)`);
      } else if (currentGame.currentPlayers >= currentGame.maxPlayers) {
        // Game is full - start the game based on game type
        if (currentGame.gameType === "chess") {
          await initializeChessGame(req.params.id);
          logger.debug(`Join Game Debug: Initialized Chess game ${req.params.id}`);
        } else {
          await initializeYahtzeeGame(req.params.id);
          logger.debug(`Join Game Debug: Initialized Yahtzee game ${req.params.id}`);
        }
        await storage.updateGameStatus(req.params.id, "running");
        logger.debug(`Join Game Debug: Updated game ${req.params.id} status to "running" (game full: ${currentGame.currentPlayers}/${currentGame.maxPlayers})`);
      } else {
        // Game is filling - ensure it stays in filling status
        await storage.updateGameStatus(req.params.id, "filling");
        logger.debug(`Join Game Debug: Game ${req.params.id} remains in filling status (${currentGame.currentPlayers}/${currentGame.maxPlayers} players)`);
      }

      const finalGame = await storage.getGame(req.params.id);
      
      // Broadcast game update to all connected clients
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastGameUpdate(req.params.id);
      }
      
      res.json(finalGame);
    } catch (error) {
      console.error("Join game error:", error);
      res.status(500).json({ message: "Failed to join game" });
    }
  });

  app.post("/api/games/:id/leave", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const userId = whopUser.id; // Use authenticated user ID instead of trusting body
      const game = await storage.getGame(req.params.id);
      const user = await storage.getUser(userId);

      if (!game || !user) {
        return res.status(404).json({ message: "Game or user not found" });
      }

      // Verify user is actually a participant in this game
      const userActiveGame = await storage.getUserActiveGame(userId);
      if (!userActiveGame || userActiveGame.id !== req.params.id) {
        return res.status(400).json({ message: "You are not a participant in this game" });
      }

      const isRunningGame = game.status === "running";
      let newBalance = parseFloat(user.balance);

      if (!isRunningGame) {
        // Game is not running yet - refund entry fee (old behavior)
        if (game.status !== "open" && game.status !== "filling") {
          return res.status(400).json({ message: "Cannot leave game in this state" });
        }
        
        newBalance = parseFloat(user.balance) + parseFloat(game.entryFee);
        await storage.updateUserBalance(userId, newBalance.toFixed(2));

        // Create refund transaction
        await storage.createTransaction({
          userId,
          type: "deposit",
          amount: game.entryFee,
          description: `${game.name} - Refund`,
          gameId: req.params.id,
          balanceAfter: newBalance.toFixed(2),
        });

        // Update user stats (subtract game from played count)
        await storage.updateUserStats(userId, Math.max(0, user.gamesPlayed - 1), user.gamesWon, user.totalWinnings);
        
        // Remove participant (game not running, so no need to worry about turn advancement)
        await storage.removeGameParticipant(req.params.id, userId);
      } else {
        // Game is running - forfeit (no refund, counts as loss)
        // User stats stay as is (game played counts, but it's a loss)
        
        // Create forfeit transaction for record keeping
        await storage.createTransaction({
          userId,
          type: "withdrawal",
          amount: "0.00", // No additional charge
          description: `${game.name} - Forfeited`,
          gameId: req.params.id,
          balanceAfter: newBalance.toFixed(2),
        });

        // Remove participant BEFORE handling turn advancement so completeGameWithWinner can correctly identify forfeited players
        await storage.removeGameParticipant(req.params.id, userId);
        
        // Handle turn advancement and potential game completion after participant is removed
        await handleForfeitTurnAdvancement(req.params.id, userId);
      }

      // Broadcast forfeit notification after removal
      if (isRunningGame) {
        const wsServer = getWebSocketServer();
        if (wsServer) {
          await wsServer.broadcastForfeitNotification(req.params.id, userId);
        }
      }

      // Update game player count
      const newPlayerCount = Math.max(0, game.currentPlayers - 1);
      await storage.updateGamePlayers(req.params.id, newPlayerCount);

      // Update game status based on new player count
      if (newPlayerCount === 0) {
        // No players left - always end the game
        await storage.updateGameStatus(req.params.id, "completed");
        logger.debug(`Leave Game Debug: Updated game ${req.params.id} status to "completed" (no players left after forfeit)`);
      } else if (!isRunningGame) {
        // Game wasn't running yet and has players left - change back to appropriate status
        if (newPlayerCount === 1) {
          await storage.updateGameStatus(req.params.id, "filling");
        } else {
          await storage.updateGameStatus(req.params.id, "filling");
        }
        logger.debug(`Leave Game Debug: Updated game ${req.params.id} status to "filling" (${newPlayerCount} players)`);
      }
      // If game is running and has players left (even just 1), let it continue

      const updatedGame = await storage.getGame(req.params.id);
      
      // Broadcast game update to all connected clients
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastGameUpdate(req.params.id);
      }
      
      res.json(updatedGame);
    } catch (error) {
      res.status(500).json({ message: "Failed to leave game" });
    }
  });

  // User active game - secured with auth
  app.get("/api/user/:id/active-game", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      // Only allow users to access their own active game
      if (req.params.id !== whopUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const activeGame = await storage.getUserActiveGame(req.params.id);
      logger.debug(`Active Game Debug for user ${req.params.id}:`, {
        foundGame: !!activeGame,
        gameId: activeGame?.id,
        gameStatus: activeGame?.status,
        gameName: activeGame?.name
      });
      res.json(activeGame || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active game" });
    }
  });

  // Transaction routes
  app.get("/api/user/:id/transactions", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      // Only allow users to access their own transactions
      if (req.params.id !== whopUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const transactions = await storage.getUserTransactions(req.params.id);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/transactions", async (req, res) => {
    try {
      const transactions = await storage.getAllTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Match result routes
  app.get("/api/user/:id/match-history", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      // Only allow users to access their own match history
      if (req.params.id !== whopUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const matchHistory = await storage.getUserMatchHistory(req.params.id, limit, offset);
      res.json(matchHistory);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch match history" });
    }
  });

  app.get("/api/games/:id/final-results", async (req, res) => {
    try {
      const finalResults = await storage.getGameFinalResults(req.params.id);
      if (!finalResults) {
        return res.status(404).json({ message: "Final results not found" });
      }
      res.json(finalResults);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch final results" });
    }
  });

  // Whop payment routes - proper implementation following docs
  // Welcome bonus endpoints
  app.get("/api/user/:id/welcome-bonus-eligible", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      if (req.params.id !== whopUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const transactions = await storage.getUserTransactions(req.params.id);
      const hasWelcomeBonusTransaction = transactions.some(t => t.description.includes("Welcome Bonus"));
      
      const isEligible = parseFloat(user.balance) === 0 && !hasWelcomeBonusTransaction;
      
      res.json({ eligible: isEligible });
    } catch (error) {
      console.error("Error checking welcome bonus eligibility:", error);
      res.status(500).json({ message: "Failed to check eligibility" });
    }
  });
  
  app.post("/api/user/:id/claim-welcome-bonus", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      if (req.params.id !== whopUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const transactions = await storage.getUserTransactions(req.params.id);
      const hasWelcomeBonusTransaction = transactions.some(t => t.description.includes("Welcome Bonus"));
      
      if (parseFloat(user.balance) !== 0 || hasWelcomeBonusTransaction) {
        return res.status(400).json({ message: "Not eligible for welcome bonus" });
      }
      
      const welcomeBonus = "2.77";
      await storage.updateUserBalance(req.params.id, welcomeBonus);
      
      const transaction = await storage.createTransaction({
        userId: req.params.id,
        type: "deposit",
        amount: welcomeBonus,
        description: "Welcome Bonus - Free credits to try games",
        balanceAfter: welcomeBonus,
      });
      
      console.log(`🎉 User ${user.username} claimed welcome bonus of $${welcomeBonus}`);
      
      const updatedUser = await storage.getUser(req.params.id);
      res.json({ success: true, user: updatedUser, transaction });
    } catch (error) {
      console.error("Error claiming welcome bonus:", error);
      res.status(500).json({ message: "Failed to claim welcome bonus" });
    }
  });

  app.post("/api/whop/charge-user", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const { amount, currency = "usd", description, metadata } = req.body;
      
      console.log(`🔄 Creating Whop charge: $${amount} for user ${whopUser.id}`);
      
      // Create charge using Whop SDK as per documentation
      const result = await whopSdk.payments.chargeUser({
        amount: amount, // Whop expects dollar amounts, not cents
        currency,
        userId: whopUser.id,
        description: description || "Compete and Earn",
        metadata: {
          ...metadata,
          userId: whopUser.id,
          experienceId: whopUser.experienceId,
          type: "game_credits",
        },
      });
      
      console.log(`✅ Whop charge result:`, JSON.stringify(result, null, 2));
      
      // Send payment attempt notification to admin
      const user = await storage.getUser(whopUser.id);
      if (user) {
        await sendPaymentAttemptNotification({
          userName: user.username,
          userId: user.id,
          amount: amount.toString(),
          userEmail: user.email || undefined,
          timestamp: new Date().toISOString(),
        });
      }
      
      // Return the inAppPurchase object for iframe SDK
      if (result?.inAppPurchase) {
        console.log(`📱 Returning inAppPurchase object for payment modal`);
        res.json(result.inAppPurchase);
      } else if (result?.status === "success") {
        console.log(`✅ Payment completed immediately without modal`);
        res.json({ success: true, result });
      } else {
        console.warn(`⚠️ Unexpected chargeUser result:`, result);
        res.json({ success: true, result });
      }
    } catch (error) {
      console.error("Charge user error:", error);
      res.status(500).json({ error: "Failed to create charge" });
    }
  });

  app.post("/api/whop/create-checkout", requireWhopAuth, async (req, res) => {
    try {
      const { planId, metadata } = req.body;
      
      const result = await whopSdk.payments.createCheckoutSession({
        planId,
        metadata,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Create checkout error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/whop/payout", requireWhopAuth, async (req, res) => {
    try {
      const { userId, amount, description } = req.body;
      
      // Get company ledger account for payouts
      const companyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID;
      if (!companyId) {
        return res.status(500).json({ error: "Company ID not configured" });
      }
      
      const ledgerAccount = await whopSdk.companies.getCompanyLedgerAccount({
        companyId,
      });
      
      if (ledgerAccount?.ledgerAccount?.id) {
        await whopSdk.payments.payUser({
          amount: Math.round(amount * 100), // Convert to cents
          currency: "usd",
          destinationId: userId,
          ledgerAccountId: ledgerAccount.ledgerAccount.id,
          transferFee: ledgerAccount.ledgerAccount.transferFee,
          idempotenceKey: `payout-${Date.now()}-${userId}`,
          reason: "content_reward_payout",
          notes: description,
        });
      } else {
        return res.status(500).json({ error: "Ledger account not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Payout error:", error);
      res.status(500).json({ error: "Failed to process payout" });
    }
  });

  // Whop push notification routes
  app.post("/api/whop/notify-experience", requireWhopAuth, async (req, res) => {
    try {
      const { experienceId, title, content, restPath, isMention = false } = req.body;
      const whopUser = (req as any).whopUser as WhopUser;
      
      await whopSdk.notifications.sendPushNotification({
        title,
        content,
        experienceId,
        restPath,
        isMention,
        senderUserId: whopUser.id,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Push notification error:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  app.post("/api/whop/notify-users", requireWhopAuth, async (req, res) => {
    try {
      const { experienceId, userIds, title, content, restPath } = req.body;
      const whopUser = (req as any).whopUser as WhopUser;
      
      await whopSdk.notifications.sendPushNotification({
        title,
        content,
        experienceId,
        userIds,
        restPath,
        senderUserId: whopUser.id,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Push notification error:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Dashboard-specific endpoints for admin panel
  app.get("/api/whop/dashboard/user/:userId", requireWhopAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      console.log(`📋 Dashboard: Fetching user info for ${userId}`);
      
      // Retrieve user data from Whop API
      const userData = await whopSdk.users.getUser({ userId });
      
      res.json(userData);
    } catch (error: any) {
      console.error("Dashboard user lookup error:", error);
      res.status(error.statusCode || 500).json({ 
        error: error.message || "Failed to retrieve user" 
      });
    }
  });

  app.get("/api/whop/dashboard/ledger-account/:companyId", requireWhopAuth, async (req, res) => {
    try {
      const { companyId } = req.params;
      
      console.log(`📋 Dashboard: Fetching ledger account for company ${companyId}`);
      
      // Retrieve company's ledger account data from Whop API
      const result = await whopSdk.companies.getCompanyLedgerAccount({ companyId });
      
      res.json(result);
    } catch (error: any) {
      console.error("Dashboard ledger account error:", error);
      res.status(error.statusCode || 500).json({ 
        error: error.message || "Failed to retrieve ledger account" 
      });
    }
  });

  app.post("/api/whop/dashboard/transfer", requireWhopAuth, async (req, res) => {
    try {
      const { amount, currency, destinationId, ledgerAccountId, transferFee, notes } = req.body;
      
      // Validate required fields
      if (!amount || !destinationId || !ledgerAccountId) {
        return res.status(400).json({ 
          error: "Missing required fields: amount, destinationId, ledgerAccountId" 
        });
      }

      // Validate amount
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ 
          error: "Amount must be a positive number" 
        });
      }

      console.log(`💸 Dashboard: Creating transfer of ${amount} ${currency || 'usd'} from ledger ${ledgerAccountId} to ${destinationId}`);
      
      // Create idempotency key for this transfer
      const idempotenceKey = `dashboard_transfer_${Date.now()}_${randomUUID()}`;
      
      // Create transfer using Whop payUser method
      const result = await whopSdk.payments.payUser({
        amount: numAmount,
        currency: currency || "usd",
        destinationId,
        ledgerAccountId,
        transferFee: transferFee || undefined,
        idempotenceKey,
        notes: notes || undefined,
      });
      
      console.log(`✅ Dashboard: Transfer created successfully`);
      
      res.json(result);
    } catch (error: any) {
      console.error("Dashboard transfer error:", error);
      res.status(error.statusCode || 500).json({ 
        error: error.message || "Failed to create transfer" 
      });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const transactions = await storage.getAllTransactions();
      const totalRevenue = transactions
        .filter(t => t.type === "entry")
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
      
      const commission = totalRevenue * 0.2; // 20% commission
      const gamesPlayed = transactions.filter(t => t.type === "entry").length;
      
      res.json({
        totalRevenue: totalRevenue.toFixed(2),
        activeUsers: 234, // Mock data
        gamesPlayed,
        commission: commission.toFixed(2),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Whop webhooks for payment validation with proper signature verification
  app.post("/api/webhooks/whop/payment", async (req, res) => {
    try {
      // TEMPORARILY DISABLED: Webhook signature validation for development testing
      // TODO: Implement proper raw body validation for production
      if (validateWebhook) {
        console.log("🔧 DEVELOPMENT: Webhook signature validation temporarily disabled for testing");
        // The issue: webhook validation needs raw request body, but we're using parsed JSON
        // For production, need to implement proper Express raw body middleware
      } else {
        console.warn("⚠️ DEVELOPMENT: Webhook signature validation is disabled for testing");
      }
      
      const { action, data } = req.body;
      const eventId = data.id; // Use payment/charge ID for idempotency
      
      switch (action) {
        case "payment.succeeded":
          console.log("Payment succeeded:", data);
          
          // CRITICAL FIX: Mark webhook as processed FIRST (atomic check-and-set)
          // This prevents race conditions - only the first request will successfully mark it
          try {
            await storage.markWebhookProcessed(eventId);
            console.log(`✅ Successfully claimed processing rights for payment ${eventId}`);
          } catch (error) {
            // If markWebhookProcessed fails, it means another request already processed this webhook
            console.log(`⏭️ Payment ${eventId} already being processed by another request - skipping`);
            break;
          }
          
          // Only continue if we successfully marked the webhook (we're the first/only processor)
          console.log(`📝 Processing payment ${eventId} - NEW payment event`);
          
          // Handle successful payment
          if (data.metadata?.userId && data.metadata?.type === "game_credits") {
            const userId = data.metadata.userId;
            const amount = Number(data.amount_after_fees ?? data.subtotal); // Amount is already in dollars from Whop
            
            // Validate amount
            if (!Number.isFinite(amount) || amount <= 0) {
              console.error(`Invalid payment amount: ${amount} for payment ${eventId}`);
              break;
            }
            
            // Add funds to user balance
            const user = await storage.getUser(userId);
            if (!user) {
              logger.error('User not found for deposit', { userId, eventId, amount });
              break;
            }
            
            const newBalance = (parseFloat(user.balance) + amount).toFixed(2); // Amount is in dollars, not cents
            await storage.updateUserBalance(userId, newBalance);
            
            // Create transaction record
            const transaction = await storage.createTransaction({
              userId,
              type: "deposit",
              amount: amount.toFixed(2),
              description: `Whop Payment - Game Credits (${eventId})`,
              balanceAfter: newBalance,
            });
            
            logger.info('Payment processed successfully', {
              userId,
              amount,
              newBalance,
              transactionId: transaction.id,
              eventId,
            });
            
            // Send real-time balance update via WebSocket
            const wsServer = getWebSocketServer();
            if (wsServer) {
              await wsServer.sendBalanceUpdate(userId);
            }
            
            // Send email notification to admin about the deposit
            const emailSent = await sendDepositNotification({
              userName: user.username,
              userId: user.id,
              amount: amount.toFixed(2),
              userEmail: user.email || undefined,
              transactionId: transaction.id,
              timestamp: new Date().toISOString(),
            });
            
            if (!emailSent) {
              logger.error('Failed to send deposit notification email, but deposit was processed successfully', {
                userId,
                transactionId: transaction.id,
              });
            }
          }
          break;
          
        case "payment.failed":
          console.log("Payment failed:", data);
          
          // Enhanced error logging for payment failures
          const failureReason = data.failure_reason || "Unknown failure reason";
          const paymentId = data.id;
          const userId = data.user_id;
          const amount = data.subtotal || data.final_amount;
          
          console.error(`💳 Payment Failure Details:
            - Payment ID: ${paymentId}
            - User ID: ${userId} 
            - Amount: $${amount}
            - Failure Reason: ${failureReason}
            - Status: ${data.status}
            - Payment Method: ${data.payment_method_type}
            - Payments Failed Count: ${data.payments_failed}
            - Last Attempt: ${new Date(data.last_payment_attempt * 1000).toISOString()}
          `);
          
          // TODO: Optionally notify user of payment failure via push notification
          break;
          
        default:
          console.log("Unknown webhook action:", action);
      }
      
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  app.post("/api/webhooks/whop/payout", async (req, res) => {
    try {
      const { event, data } = req.body;
      
      switch (event) {
        case "payout.completed":
          console.log("Payout completed:", data);
          break;
          
        case "payout.failed":
          console.log("Payout failed:", data);
          break;
          
        default:
          console.log("Unknown payout webhook event:", event);
      }
      
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Payout webhook error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Helper function to select winner
  async function selectWinner(gameId: string) {
    try {
      const participants = await storage.getGameParticipants(gameId);
      if (participants.length === 0) return;

      // Find winner by highest Yahtzee score
      let highestScore = -1;
      let winnerParticipant = participants[0];
      
      for (const participant of participants) {
        const playerState = await storage.getYahtzeePlayerState(gameId, participant.userId);
        const score = playerState?.totalScore || 0;
        if (score > highestScore) {
          highestScore = score;
          winnerParticipant = participant;
        }
      }
      const game = await storage.getGame(gameId);
      if (!game) return;

      // Update game with winner
      await storage.updateGameStatus(gameId, "completed", winnerParticipant.userId);

      // Award prize to winner using Whop payUser API
      const winner = await storage.getUser(winnerParticipant.userId);
      if (winner) {
        const prizeAmount = parseFloat(game.prizeAmount);
        
        const paymentSuccess = await payWinner({
          userId: winnerParticipant.userId,
          amount: prizeAmount,
          description: `${game.name} - Winner Prize`,
          gameId,
        });

        if (paymentSuccess) {
          const updatedWinner = await storage.getUser(winnerParticipant.userId);
          if (updatedWinner) {
            const newTotalWinnings = (parseFloat(updatedWinner.totalWinnings) + prizeAmount).toFixed(2);
            await storage.updateUserStats(winnerParticipant.userId, updatedWinner.gamesPlayed, updatedWinner.gamesWon + 1, newTotalWinnings);
          }
        } else {
          console.error(`Failed to pay winner ${winnerParticipant.userId} for game ${gameId} - balance not updated!`);
        }
      }

      // Process commission through Whop
      const totalEntryFees = parseFloat(game.entryFee) * game.maxPlayers;
      const commissionAmount = totalEntryFees - parseFloat(game.prizeAmount);
      
      if (commissionAmount > 0) {
        await processCommission(commissionAmount, gameId);
        
        // Create commission transaction record
        await storage.createTransaction({
          userId: "platform",
          type: "commission",
          amount: commissionAmount.toFixed(2),
          description: `${game.name} - Platform Commission`,
          gameId,
          balanceAfter: "0.00",
        });
      }

      // Broadcast winner announcement via WebSocket
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastWinnerAnnouncement(gameId, winnerParticipant.userId);
        await wsServer.broadcastGameUpdate(gameId);
      }

    } catch (error) {
      console.error("Error selecting winner:", error);
    }
  }

  // Yahtzee Game Logic Functions
  async function initializeYahtzeeGame(gameId: string) {
    try {
      const participants = await storage.getGameParticipants(gameId);
      const game = await storage.getGame(gameId);
      
      // Guard against premature initialization
      if (!game || participants.length === 0) {
        logger.debug(`Init Guard: Cannot initialize - missing game or no participants`);
        return;
      }
      
      // Check if yahtzee player states already exist to prevent duplicate initialization
      const existingStates = await storage.getYahtzeeGameStates(gameId);
      if (existingStates && existingStates.length > 0) {
        logger.debug(`Init Guard: Game ${gameId} already has yahtzee player states, skipping initialization`);
        return;
      }
      
      if (participants.length < game.maxPlayers) {
        logger.debug(`Init Guard: Game ${gameId} not full (${participants.length}/${game.maxPlayers}), cannot start`);
        return;
      }

      logger.debug(`Init Guard: Starting game ${gameId} with ${participants.length}/${game.maxPlayers} players`);
      
      // Initialize Yahtzee player states for all participants FIRST
      for (const participant of participants) {
        await storage.createYahtzeePlayerState({
          gameId,
          userId: participant.userId,
        });
      }

      // Set first player as current turn player and start round 1
      const firstPlayerId = participants[0].userId;
      await storage.updateGameTurn(gameId, 1, firstPlayerId);

      // Create the first turn for the first player
      const firstTurn = await storage.createYahtzeeTurn({
        gameId,
        userId: firstPlayerId,
        round: 1,
      });

      // Verify turn was created successfully before proceeding
      if (!firstTurn) {
        logger.error(`Failed to create first turn for game ${gameId}`);
        throw new Error('Failed to initialize game turn');
      }

      // ONLY NOW update game status to running - all required data is ready
      if (game.status !== "running") {
        await storage.updateGameStatus(gameId, "running");
      }

      // Verify turn exists before broadcasting (handles retry scenarios)
      const verifiedTurn = await storage.getCurrentYahtzeeTurn(gameId, firstPlayerId);
      if (!verifiedTurn) {
        logger.error(`Turn verification failed for game ${gameId} - turn does not exist after creation`);
        throw new Error('Game initialization incomplete - turn missing');
      }

      // Broadcast game started ONLY AFTER status and turn are both verified
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastGameUpdate(gameId);
      }

      // Check if the first player is an AI and trigger AI processing
      if (firstPlayerId.startsWith('ai-')) {
        logger.debug(`Game initialized with AI first player ${firstPlayerId}, triggering AI processing`);
        // Trigger AI turn processing with a short delay to allow for game state broadcast
        setTimeout(() => processAITurn(gameId, firstPlayerId), 1500);
      }

    } catch (error) {
      console.error("Error initializing Yahtzee game:", error);
    }
  }

  async function initializeChessGame(gameId: string) {
    try {
      const participants = await storage.getGameParticipants(gameId);
      const game = await storage.getGame(gameId);
      
      if (!game || participants.length === 0) {
        logger.debug(`Chess Init: Cannot initialize - missing game or no participants`);
        return;
      }
      
      // Check if chess state already exists to prevent duplicate initialization
      const existingChessState = await storage.getChessGameState(gameId);
      if (existingChessState) {
        logger.debug(`Chess Init: Game ${gameId} already has chess state, skipping initialization`);
        return;
      }
      
      if (participants.length < 2) {
        logger.debug(`Chess Init: Chess game ${gameId} needs 2 players (currently ${participants.length})`);
        return;
      }

      logger.debug(`Chess Init: Starting chess game ${gameId} with ${participants.length} players`);
      
      // Only update status to running if it's not already running
      if (game.status !== "running") {
        await storage.updateGameStatus(gameId, "running");
      }

      const whitePlayerId = participants[0].userId;
      const blackPlayerId = participants[1].userId;
      
      const initialBoard = initializeChessBoard();
      
      await storage.createChessGameState({
        gameId,
        boardState: JSON.stringify(initialBoard),
        whitePlayerId,
        blackPlayerId,
        currentTurn: "white",
        gameStatus: "in_progress",
        whiteKingsideCastle: true,
        whiteQueensideCastle: true,
        blackKingsideCastle: true,
        blackQueensideCastle: true,
        enPassantTarget: null,
        moveCount: 0,
        halfmoveClock: 0,
        capturedPieces: "[]",
      });

      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastGameUpdate(gameId);
      }

      logger.debug(`Chess Init: Chess game ${gameId} initialized successfully`);
    } catch (error) {
      console.error("Error initializing Chess game:", error);
    }
  }

  function rollDice(): number[] {
    return Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
  }

  // AI re-entrancy protection
  const aiProcessingLocks = new Set<string>();

  // AI Turn Processing
  async function processAITurn(gameId: string, aiUserId: string): Promise<void> {
    const lockKey = `${gameId}-${aiUserId}`;
    
    // Prevent concurrent AI processing for the same player
    if (aiProcessingLocks.has(lockKey)) {
      console.log(`⚠️ AI Turn: Already processing for ${aiUserId} in game ${gameId}, skipping`);
      return;
    }
    
    try {
      aiProcessingLocks.add(lockKey);
      console.log(`🤖 Processing AI turn for player ${aiUserId} in game ${gameId}`);
      
      // Loop until the AI makes a scoring decision or the turn is completed
      while (true) {
        const game = await storage.getGame(gameId);
        const currentTurn = await storage.getCurrentYahtzeeTurn(gameId, aiUserId);
        const playerState = await storage.getYahtzeePlayerState(gameId, aiUserId);
        
        if (!game || !currentTurn || !playerState) {
          logger.error(`AI Turn: Missing game data for ${aiUserId} in game ${gameId}`);
          return;
        }
        
        // Critical: Verify this is actually the AI's turn and turn is not completed
        if (game.currentTurnPlayerId !== aiUserId) {
          console.log(`❌ AI Turn: Not ${aiUserId}'s turn (current: ${game.currentTurnPlayerId}), skipping`);
          return;
        }
        
        if (currentTurn.isCompleted) {
          console.log(`❌ AI Turn: Turn already completed for ${aiUserId}, skipping`);
          return;
        }
        
        // Ensure the turn belongs to the current round
        if (currentTurn.round !== game.currentRound) {
          console.log(`❌ AI Turn: Turn round mismatch for ${aiUserId} (turn: ${currentTurn.round}, game: ${game.currentRound}), skipping`);
          return;
        }
        
        // Get current dice values
        const dice = [
          currentTurn.dice1 || 1,
          currentTurn.dice2 || 1,
          currentTurn.dice3 || 1,
          currentTurn.dice4 || 1,
          currentTurn.dice5 || 1
        ];
        
        // Get available categories for this AI player
        const availableCategories = getAvailableCategories(playerState);
        const rollCount = currentTurn.rollCount || 0;
        
        // Get WebSocket server for broadcasting AI actions
        const wsServer = getWebSocketServer();
        
        // AI thinking silently (no visual indicator)

        // Make AI decision
        const decision = makeAIDecision(dice, rollCount, availableCategories, playerState);
        
        // Execute the decision with delay for realistic timing
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (decision.type === 'hold' && decision.holdPattern && rollCount < 3) {
          // AI wants to hold certain dice and reroll others
          logger.debug(`AI ${aiUserId} holding dice pattern: ${decision.holdPattern}`);
          
          // AI holding dice silently (no visual indicator)
          await new Promise(resolve => setTimeout(resolve, 400));
          
          // Update dice hold state
          await storage.updateYahtzeeTurn(currentTurn.id, {
            hold1: decision.holdPattern[0],
            hold2: decision.holdPattern[1], 
            hold3: decision.holdPattern[2],
            hold4: decision.holdPattern[3],
            hold5: decision.holdPattern[4],
          });
          
          // Immediately broadcast game update to show HOLD indicators
          if (wsServer) {
            await wsServer.broadcastGameUpdate(gameId);
          }
          await new Promise(resolve => setTimeout(resolve, 400));
          
          // AI rolling dice silently (no visual indicator)
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Roll the dice (only non-held ones)
          const newDice = rollDice();
          const updatedDice = dice.map((die, index) => 
            decision.holdPattern![index] ? die : newDice[index]
          );
          
          await storage.updateYahtzeeTurn(currentTurn.id, {
            dice1: updatedDice[0],
            dice2: updatedDice[1],
            dice3: updatedDice[2],
            dice4: updatedDice[3],
            dice5: updatedDice[4],
            rollCount: rollCount + 1,
          });
          
          // Broadcast the dice roll update
          if (wsServer) {
            await wsServer.broadcastGameUpdate(gameId);
          }
          
          // Wait before next decision and continue the loop
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue; // Continue the while loop for next decision
          
        } else if (decision.type === 'score' && decision.category) {
          // AI wants to score a category
          logger.debug(`AI ${aiUserId} scoring category: ${decision.category}`);
          
          // Calculate score for the chosen category
          const score = calculateScore(dice, decision.category);
          
          // Show AI scoring decision
          const categoryLabels: Record<string, string> = {
            ones: 'Ones', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes',
            threeOfAKind: '3 of a Kind', fourOfAKind: '4 of a Kind', fullHouse: 'Full House', 
            smallStraight: 'Small Straight', largeStraight: 'Large Straight', yahtzee: 'Yahtzee', chance: 'Chance'
          };
          const categoryName = categoryLabels[decision.category] || decision.category;
          if (wsServer) {
            await wsServer.broadcastAIAction(gameId, aiUserId, {
              type: 'scoring',
              message: `Scored ${categoryName} for ${score} points!`,
              category: decision.category,
              diceValues: dice,
            });
          }
          await new Promise(resolve => setTimeout(resolve, 700));
          
          // Update player state with the score
          const stateUpdates: any = {
            [decision.category]: score,
            turnsCompleted: (playerState.turnsCompleted || 0) + 1
          };
          
          // Create temporary state to calculate bonuses
          const tempState = { ...playerState, ...stateUpdates };
          
          // Calculate upper section bonus if applicable
          const upperSectionCategories = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
          const upperSectionScores = upperSectionCategories.map(cat => tempState[cat] === -1 ? 0 : (tempState[cat] || 0));
          const upperSectionTotal = upperSectionScores.reduce((sum, score) => sum + score, 0);
          
          if (upperSectionTotal >= 63 && tempState.upperSectionBonus === 0) {
            stateUpdates.upperSectionBonus = 35;
          }
          
          // Calculate total score
          const allScores = Object.values(tempState).filter(val => typeof val === 'number' && val !== -1);
          stateUpdates.totalScore = allScores.reduce((sum: number, score: any) => sum + (score || 0), 0);
          
          // Update the player state
          await storage.updateYahtzeePlayerState(gameId, aiUserId, stateUpdates);
          
          // Mark turn as completed
          await storage.updateYahtzeeTurn(currentTurn.id, {
            isCompleted: true,
            scoredCategory: decision.category,
            scoredPoints: score,
          });
          
          // Advance to next turn
          await advanceTurn(gameId);
          
          // Broadcast updates
          if (wsServer) {
            await wsServer.broadcastGameUpdate(gameId);
          }
          
          // Exit the loop as the turn is complete
          break;
        }
      }
      
    } catch (error) {
      logger.error(`Error processing AI turn for ${aiUserId} in game ${gameId}:`, error);
    } finally {
      // Always release the lock
      aiProcessingLocks.delete(lockKey);
    }
  }

  function calculateScore(dice: number[], category: YahtzeeCategory): number {
    const counts = dice.reduce((acc, die) => {
      acc[die] = (acc[die] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const sortedCounts = Object.values(counts).sort((a, b) => b - a);
    const sum = dice.reduce((a, b) => a + b, 0);

    switch (category) {
      // Upper Section Categories - count specific numbers
      case 'ones': return (counts[1] || 0) * 1;
      case 'twos': return (counts[2] || 0) * 2;
      case 'threes': return (counts[3] || 0) * 3;
      case 'fours': return (counts[4] || 0) * 4;
      case 'fives': return (counts[5] || 0) * 5;
      case 'sixes': return (counts[6] || 0) * 6;
      
      // Lower Section Categories
      case 'threeOfAKind': return sortedCounts[0] >= 3 ? sum : 0;
      case 'fourOfAKind': return sortedCounts[0] >= 4 ? sum : 0;
      case 'fullHouse': return sortedCounts[0] === 3 && sortedCounts[1] === 2 ? YAHTZEE_FIXED_SCORES.fullHouse : 0;
      case 'smallStraight': {
        const uniqueDice = Array.from(new Set(dice)).sort();
        const straights = [[1,2,3,4], [2,3,4,5], [3,4,5,6]];
        return straights.some(straight => straight.every(num => uniqueDice.includes(num))) ? YAHTZEE_FIXED_SCORES.smallStraight : 0;
      }
      case 'largeStraight': {
        const uniqueDice = Array.from(new Set(dice)).sort();
        return (uniqueDice.join('') === '12345' || uniqueDice.join('') === '23456') ? YAHTZEE_FIXED_SCORES.largeStraight : 0;
      }
      case 'yahtzee': return sortedCounts[0] === 5 ? YAHTZEE_FIXED_SCORES.yahtzee : 0;
      case 'chance': return sum;
      default: return 0;
    }
  }

  function calculateTotalScore(playerState: any): number {
    let total = 0;
    
    // Upper Section Categories
    const upperSectionCategories = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
    let upperSectionTotal = 0;
    
    for (const category of upperSectionCategories) {
      const score = playerState[category];
      if (score !== undefined && score !== -1) {
        upperSectionTotal += score;
      }
    }
    
    total += upperSectionTotal;
    
    // Upper Section Bonus (35 points if upper section >= 63)
    const upperSectionBonus = upperSectionTotal >= 63 ? 35 : 0;
    total += upperSectionBonus;
    
    // Lower Section Categories
    const lowerSectionCategories = ['threeOfAKind', 'fourOfAKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'];
    
    for (const category of lowerSectionCategories) {
      const score = playerState[category];
      if (score !== undefined && score !== -1) {
        total += score;
      }
    }
    
    // Yahtzee bonus (100 points for each additional yahtzee after the first)
    if (playerState.yahtzeeBonus !== undefined) {
      total += playerState.yahtzeeBonus;
    }

    return total;
  }

  async function advanceTurn(gameId: string) {
    try {
      const game = await storage.getGame(gameId);
      const participants = await storage.getGameParticipants(gameId);
      if (!game || !participants.length) return;

      const currentPlayerIndex = participants.findIndex(p => p.userId === game.currentTurnPlayerId);
      const nextPlayerIndex = (currentPlayerIndex + 1) % participants.length;
      const nextPlayerId = participants[nextPlayerIndex].userId;

      // Check if we completed a full round
      if (nextPlayerIndex === 0) {
        // All players completed the round, advance to next round
        const nextRound = (game.currentRound || 1) + 1;
        
        if (nextRound > game.totalRounds) {
          // Game complete!
          await completeYahtzeeGame(gameId);
          return;
        }
        
        await storage.updateGameTurn(gameId, nextRound, nextPlayerId);
      } else {
        // Same round, next player
        await storage.updateGameTurn(gameId, game.currentRound || 1, nextPlayerId);
      }

      // Create turn for next player
      const currentRound = nextPlayerIndex === 0 ? (game.currentRound || 1) + 1 : (game.currentRound || 1);
      if (currentRound <= game.totalRounds) {
        await storage.createYahtzeeTurn({
          gameId,
          userId: nextPlayerId,
          round: currentRound,
        });
      }

      // Check if the next player is an AI and trigger AI processing
      if (nextPlayerId.startsWith('ai-')) {
        logger.debug(`Turn advanced to AI player ${nextPlayerId}, triggering AI processing`);
        // Trigger AI turn processing with a short delay to allow for game state updates
        setTimeout(() => processAITurn(gameId, nextPlayerId), 1000);
      }

      // Broadcast game state update
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastGameUpdate(gameId);
      }

    } catch (error) {
      console.error("Error advancing turn:", error);
    }
  }

  async function handleForfeitTurnAdvancement(gameId: string, forfeitedUserId: string) {
    try {
      const game = await storage.getGame(gameId);
      let participants = await storage.getGameParticipants(gameId);
      if (!game || !participants.length) return;

      // If the forfeited player was the current turn player, advance to next player
      if (game.currentTurnPlayerId === forfeitedUserId) {
        console.log(`Forfeit turn advancement: Player ${forfeitedUserId} forfeited during their turn`);
        
        // Filter out the forfeited player to get remaining active participants
        const activeParticipants = participants.filter(p => p.userId !== forfeitedUserId);
        
        if (activeParticipants.length === 0) {
          console.log("No active participants left after forfeit - ending game");
          await storage.updateGameStatus(gameId, "completed");
          return;
        }

        if (activeParticipants.length === 1) {
          // Only one player left - declare them the winner automatically
          console.log(`Only one player left after forfeit: ${activeParticipants[0].userId} - declaring winner`);
          await completeYahtzeeGameWithWinner(gameId, activeParticipants[0].userId);
          return;
        }

        // Find current player index in the original participants list
        const currentPlayerIndex = participants.findIndex(p => p.userId === forfeitedUserId);
        
        // Find the next active player by looking through the remaining participants
        let nextPlayerId: string;
        
        // Start searching from the next position after the forfeited player
        for (let i = 1; i < participants.length; i++) {
          const candidateIndex = (currentPlayerIndex + i) % participants.length;
          const candidatePlayer = participants[candidateIndex];
          
          // Check if this player is still active (not the forfeited one)
          if (candidatePlayer.userId !== forfeitedUserId) {
            nextPlayerId = candidatePlayer.userId;
            break;
          }
        }
        
        console.log(`Advancing turn from ${forfeitedUserId} to ${nextPlayerId!}`);

        // Update the game's current turn player
        await storage.updateGameTurn(gameId, game.currentRound || 1, nextPlayerId!);

        // Create a new turn for the next player if they don't already have one for this round
        const existingTurn = await storage.getCurrentYahtzeeTurn(gameId, nextPlayerId!);
        if (!existingTurn) {
          await storage.createYahtzeeTurn({
            gameId,
            userId: nextPlayerId!,
            round: game.currentRound || 1,
          });
          console.log(`Created new turn for player ${nextPlayerId!} in round ${game.currentRound || 1}`);
        }

        // Broadcast game state update
        const wsServer = getWebSocketServer();
        if (wsServer) {
          await wsServer.broadcastGameUpdate(gameId);
        }
      } else {
        console.log(`Player ${forfeitedUserId} forfeited but it wasn't their turn (current: ${game.currentTurnPlayerId})`);
        
        // Even if it's not their turn, check if only one player remains after this forfeit
        const activeParticipants = participants.filter(p => p.userId !== forfeitedUserId);
        if (activeParticipants.length === 1) {
          console.log(`Only one player left after forfeit: ${activeParticipants[0].userId} - declaring winner`);
          await completeYahtzeeGameWithWinner(gameId, activeParticipants[0].userId);
          return;
        }
      }
    } catch (error) {
      console.error("Error handling forfeit turn advancement:", error);
    }
  }

  async function completeYahtzeeGameWithWinner(gameId: string, winnerId: string) {
    try {
      console.log(`Completing game ${gameId} with predetermined winner: ${winnerId}`);
      
      const game = await storage.getGame(gameId);
      if (!game) return;

      // Complete the game with the specified winner
      await storage.updateGameStatus(gameId, "completed", winnerId);

      // Get all player states for match results
      const gameStates = await storage.getYahtzeeGameStates(gameId);
      const currentParticipants = await storage.getGameParticipants(gameId);
      
      // Get all original participants who ever joined this game (including those who forfeited)
      const allTransactions = await storage.getAllTransactions();
      const originalParticipantIds = new Set(
        allTransactions
          .filter(t => t.gameId === gameId && t.type === "entry")
          .map(t => t.userId)
      );
      
      // Save match results for posterity
      const matchResultPlayers = [];
      
      // Current participants who didn't forfeit - Award winner first place, others get ranks based on their current scores
      const activePlayerResults = gameStates
        .map(state => ({
          ...state,
          totalScore: calculateTotalScore(state)
        }))
        .sort((a, b) => {
          // Winner always gets rank 1
          if (a.userId === winnerId) return -1;
          if (b.userId === winnerId) return 1;
          // Others sorted by score
          return b.totalScore - a.totalScore;
        });

      // Add active players to results
      for (let i = 0; i < activePlayerResults.length; i++) {
        const playerState = activePlayerResults[i];
        const user = await storage.getUser(playerState.userId);
        const isWinner = playerState.userId === winnerId;
        const entryFee = parseFloat(game.entryFee);
        const prizeAmount = isWinner ? parseFloat(game.prizeAmount) : 0;
        const netChange = prizeAmount - entryFee;

        matchResultPlayers.push({
          userId: playerState.userId,
          username: user?.username || `Player${playerState.userId.slice(-4)}`,
          totalScore: playerState.totalScore,
          rank: i + 1,
          entryFee: entryFee.toFixed(2),
          netChange: netChange.toFixed(2),
          forfeited: false
        });
      }

      // Add forfeited players to results (they get last ranks)
      const currentParticipantIds = new Set(currentParticipants.map(p => p.userId));
      const forfeitedUserIds = Array.from(originalParticipantIds).filter(id => !currentParticipantIds.has(id));
      
      for (const forfeitedUserId of forfeitedUserIds) {
        const user = await storage.getUser(forfeitedUserId);
        const entryFee = parseFloat(game.entryFee);
        const netChange = -entryFee; // They lost their entry fee

        matchResultPlayers.push({
          userId: forfeitedUserId,
          username: user?.username || `Player${forfeitedUserId.slice(-4)}`,
          totalScore: 0, // Forfeited players get 0 score
          rank: activePlayerResults.length + forfeitedUserIds.indexOf(forfeitedUserId) + 1,
          entryFee: entryFee.toFixed(2),
          netChange: netChange.toFixed(2),
          forfeited: true
        });
      }

      await storage.saveMatchResult(
        {
          gameId,
          winnerId,
          prizeAmount: game.prizeAmount
        },
        matchResultPlayers
      );

      // Award prize to winner
      const winner = await storage.getUser(winnerId);
      if (winner) {
        const prizeAmount = parseFloat(game.prizeAmount);
        
        const paymentSuccess = await payWinner({
          userId: winnerId,
          amount: prizeAmount,
          description: `${game.name} - Winner by Forfeit`,
          gameId,
        });

        if (paymentSuccess) {
          const updatedWinner = await storage.getUser(winnerId);
          if (updatedWinner) {
            const newTotalWinnings = (parseFloat(updatedWinner.totalWinnings) + prizeAmount).toFixed(2);
            await storage.updateUserStats(winnerId, updatedWinner.gamesPlayed, updatedWinner.gamesWon + 1, newTotalWinnings);
          }
        } else {
          console.error(`Failed to pay winner ${winnerId} for game ${gameId} - balance not updated!`);
        }
      }

      // Process commission
      const totalEntryFees = parseFloat(game.entryFee) * game.maxPlayers;
      const commissionAmount = totalEntryFees - parseFloat(game.prizeAmount);
      
      if (commissionAmount > 0) {
        await processCommission(commissionAmount, gameId);
        
        await storage.createTransaction({
          userId: "platform",
          type: "commission",
          amount: commissionAmount.toFixed(2),
          description: `${game.name} - Platform Commission`,
          gameId,
          balanceAfter: "0.00",
        });
      }

      // Broadcast winner announcement
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastWinnerAnnouncement(gameId, winnerId);
        await wsServer.broadcastGameUpdate(gameId);
      }

    } catch (error) {
      console.error("Error completing Yahtzee game with winner:", error);
    }
  }

  async function completeYahtzeeGame(gameId: string) {
    try {
      const gameStates = await storage.getYahtzeeGameStates(gameId);
      const game = await storage.getGame(gameId);
      if (!game || !gameStates.length) return;

      // Calculate final scores for all players
      let highestScore = 0;
      let winnerId = "";

      for (const state of gameStates) {
        const totalScore = calculateTotalScore(state);
        await storage.updateYahtzeePlayerState(gameId, state.userId, { totalScore });
        
        if (totalScore > highestScore) {
          highestScore = totalScore;
          winnerId = state.userId;
        }
      }

      // Complete the game
      await storage.updateGameStatus(gameId, "completed", winnerId);

      // Save match results for posterity
      const currentParticipants = await storage.getGameParticipants(gameId);
      
      // Get all original participants who ever joined this game (including those who forfeited)
      const allTransactions = await storage.getAllTransactions();
      const originalParticipantIds = new Set(
        allTransactions
          .filter(t => t.gameId === gameId && t.type === "entry")
          .map(t => t.userId)
      );
      
      const matchResultPlayers = [];
      
      // Create sorted player results for active players
      const activePlayerResults = gameStates
        .map(state => ({
          ...state,
          totalScore: calculateTotalScore(state)
        }))
        .sort((a, b) => b.totalScore - a.totalScore);

      // Add active players to results
      for (let i = 0; i < activePlayerResults.length; i++) {
        const playerState = activePlayerResults[i];
        const user = await storage.getUser(playerState.userId);
        const isWinner = playerState.userId === winnerId;
        const entryFee = parseFloat(game.entryFee);
        const prizeAmount = isWinner ? parseFloat(game.prizeAmount) : 0;
        const netChange = prizeAmount - entryFee;

        matchResultPlayers.push({
          userId: playerState.userId,
          username: user?.username || `Player${playerState.userId.slice(-4)}`,
          totalScore: playerState.totalScore,
          rank: i + 1,
          entryFee: entryFee.toFixed(2),
          netChange: netChange.toFixed(2),
          forfeited: false
        });
      }

      // Add forfeited players to results (they get last ranks)
      const currentParticipantIds = new Set(currentParticipants.map(p => p.userId));
      const forfeitedUserIds = Array.from(originalParticipantIds).filter(id => !currentParticipantIds.has(id));
      
      for (const forfeitedUserId of forfeitedUserIds) {
        const user = await storage.getUser(forfeitedUserId);
        const entryFee = parseFloat(game.entryFee);
        const netChange = -entryFee; // They lost their entry fee

        matchResultPlayers.push({
          userId: forfeitedUserId,
          username: user?.username || `Player${forfeitedUserId.slice(-4)}`,
          totalScore: 0, // Forfeited players get 0 score
          rank: activePlayerResults.length + forfeitedUserIds.indexOf(forfeitedUserId) + 1,
          entryFee: entryFee.toFixed(2),
          netChange: netChange.toFixed(2),
          forfeited: true
        });
      }

      await storage.saveMatchResult(
        {
          gameId,
          winnerId,
          prizeAmount: game.prizeAmount
        },
        matchResultPlayers
      );

      // Award prize to winner using existing winner logic
      const winner = await storage.getUser(winnerId);
      if (winner) {
        const prizeAmount = parseFloat(game.prizeAmount);
        
        const paymentSuccess = await payWinner({
          userId: winnerId,
          amount: prizeAmount,
          description: `${game.name} - Yahtzee Winner Prize`,
          gameId,
        });

        if (paymentSuccess) {
          const updatedWinner = await storage.getUser(winnerId);
          if (updatedWinner) {
            const newTotalWinnings = (parseFloat(updatedWinner.totalWinnings) + prizeAmount).toFixed(2);
            await storage.updateUserStats(winnerId, updatedWinner.gamesPlayed, updatedWinner.gamesWon + 1, newTotalWinnings);
          }
        } else {
          console.error(`Failed to pay winner ${winnerId} for game ${gameId} - balance not updated!`);
        }
      }

      // Process commission
      const totalEntryFees = parseFloat(game.entryFee) * game.maxPlayers;
      const commissionAmount = totalEntryFees - parseFloat(game.prizeAmount);
      
      if (commissionAmount > 0) {
        await processCommission(commissionAmount, gameId);
        
        await storage.createTransaction({
          userId: "platform",
          type: "commission",
          amount: commissionAmount.toFixed(2),
          description: `${game.name} - Platform Commission`,
          gameId,
          balanceAfter: "0.00",
        });
      }

      // Broadcast winner announcement
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastWinnerAnnouncement(gameId, winnerId);
        await wsServer.broadcastGameUpdate(gameId);
      }

    } catch (error) {
      console.error("Error completing Yahtzee game:", error);
    }
  }

  // Yahtzee API endpoints
  app.get("/api/games/:id/yahtzee-state", requireWhopAuth, async (req, res) => {
    try {
      const game = await storage.getGame(req.params.id);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      const gameStates = await storage.getYahtzeeGameStates(req.params.id);
      const participants = await storage.getGameParticipants(req.params.id);
      
      // Self-healing: If running game has no player states, initialize them
      if (game.status === "running" && gameStates.length === 0 && participants.length > 0) {
        logger.info(`Self-healing: Running game ${req.params.id} has no player states, initializing...`);
        
        // Initialize Yahtzee player states for all participants
        for (const participant of participants) {
          await storage.createYahtzeePlayerState({
            gameId: req.params.id,
            userId: participant.userId,
          });
        }

        // Set first player as current turn player if not set
        if (!game.currentTurnPlayerId) {
          const firstPlayerId = participants[0].userId;
          await storage.updateGameTurn(req.params.id, game.currentRound || 1, firstPlayerId);
          
          // Create the first turn for the first player
          const existingTurn = await storage.getCurrentYahtzeeTurn(req.params.id, firstPlayerId);
          if (!existingTurn) {
            await storage.createYahtzeeTurn({
              gameId: req.params.id,
              userId: firstPlayerId,
              round: game.currentRound || 1,
            });
          }
        }

        // Broadcast game update
        const wsServer = getWebSocketServer();
        if (wsServer) {
          await wsServer.broadcastGameUpdate(req.params.id);
        }
        
        logger.info(`Self-healing: Game ${req.params.id} player states initialized`);
        
        // Re-fetch game states after initialization
        const updatedGameStates = await storage.getYahtzeeGameStates(req.params.id);
        const playersWithStates = await Promise.all(
          participants.map(async (participant) => {
            const user = await storage.getUser(participant.userId);
            const state = updatedGameStates.find(s => s.userId === participant.userId);
            return { 
              user, 
              state: state ? {
                ...state,
                totalScore: calculateTotalScore(state)
              } : null 
            };
          })
        );

        return res.json({
          game,
          players: playersWithStates,
          currentTurnUserId: game.currentTurnPlayerId,
          currentRound: game.currentRound
        });
      }
      
      // Get user data for each participant
      const playersWithStates = await Promise.all(
        participants.map(async (participant) => {
          const user = await storage.getUser(participant.userId);
          const state = gameStates.find(s => s.userId === participant.userId);
          return { 
            user, 
            state: state ? {
              ...state,
              totalScore: calculateTotalScore(state)
            } : null 
          };
        })
      );

      res.json({
        game,
        players: playersWithStates,
        currentTurnUserId: game.currentTurnPlayerId,
        currentRound: game.currentRound
      });
    } catch (error) {
      console.error("Failed to fetch Yahtzee game state:", error);
      res.status(500).json({ message: "Failed to fetch game state" });
    }
  });

  app.get("/api/games/:id/current-turn", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const game = await storage.getGame(req.params.id);
      
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Check if user is a participant in the game (not just current turn player)
      const participants = await storage.getGameParticipants(req.params.id);
      const isParticipant = participants.some(p => p.userId === whopUser.id);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Not a participant in this game" });
      }

      // Self-healing: If running game has no current turn player, set the first participant
      if (!game.currentTurnPlayerId && game.status === "running") {
        const participants = await storage.getGameParticipants(req.params.id);
        
        if (participants.length > 0) {
          const firstPlayerId = participants[0].userId;
          await storage.updateGameTurn(req.params.id, game.currentRound || 1, firstPlayerId);
          
          // Create turn if it doesn't exist
          const existingTurn = await storage.getCurrentYahtzeeTurn(req.params.id, firstPlayerId);
          if (!existingTurn) {
            await storage.createYahtzeeTurn({
              gameId: req.params.id,
              userId: firstPlayerId,
              round: game.currentRound || 1,
            });
          }
          
          // Update the game object for the response
          game.currentTurnPlayerId = firstPlayerId;
          logger.info(`Self-healed game ${req.params.id}: set currentTurnPlayerId to ${firstPlayerId}`);
        } else {
          return res.status(400).json({ message: "No participants in running game" });
        }
      } else if (!game.currentTurnPlayerId) {
        return res.status(400).json({ message: "No current turn player set" });
      }

      // Get current turn data for the actual current turn player
      let currentTurn = await storage.getCurrentYahtzeeTurn(req.params.id, game.currentTurnPlayerId);
      
      // Self-healing: If turn doesn't exist but game is running and has currentTurnPlayerId, create it
      if (!currentTurn && game.status === "running" && game.currentTurnPlayerId) {
        logger.info(`Self-healing: Creating missing turn for game ${req.params.id}, player ${game.currentTurnPlayerId}`);
        
        // Check if player states exist, if not create them
        const gameStates = await storage.getYahtzeeGameStates(req.params.id);
        if (gameStates.length === 0) {
          logger.info(`Self-healing: Creating missing player states for game ${req.params.id}`);
          const participants = await storage.getGameParticipants(req.params.id);
          for (const participant of participants) {
            await storage.createYahtzeePlayerState({
              gameId: req.params.id,
              userId: participant.userId,
            });
          }
        }
        
        // Create the missing turn
        await storage.createYahtzeeTurn({
          gameId: req.params.id,
          userId: game.currentTurnPlayerId,
          round: game.currentRound || 1,
        });
        
        // Fetch the newly created turn
        currentTurn = await storage.getCurrentYahtzeeTurn(req.params.id, game.currentTurnPlayerId);
        
        if (currentTurn) {
          logger.info(`Self-healed game ${req.params.id}: created missing turn for ${game.currentTurnPlayerId}`);
        }
      }
      
      if (!currentTurn) {
        return res.status(404).json({ message: "No active turn found" });
      }

      // Return turn data with additional context
      res.json({
        ...currentTurn,
        isYourTurn: game.currentTurnPlayerId === whopUser.id,
        currentTurnUserId: game.currentTurnPlayerId
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch current turn" });
    }
  });

  app.post("/api/games/:id/roll-dice", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const game = await storage.getGame(req.params.id);
      
      if (!game || game.status !== "running") {
        return res.status(400).json({ message: "Game not running" });
      }

      if (game.currentTurnPlayerId !== whopUser.id) {
        return res.status(403).json({ message: "Not your turn" });
      }

      const currentTurn = await storage.getCurrentYahtzeeTurn(req.params.id, whopUser.id);
      if (!currentTurn) {
        return res.status(404).json({ message: "No active turn found" });
      }

      if (currentTurn.rollCount >= 3) {
        return res.status(400).json({ message: "Maximum rolls reached" });
      }

      // Roll dice (reroll non-held dice)
      const newDice = rollDice();
      const updatedTurn = await storage.updateYahtzeeTurn(currentTurn.id, {
        dice1: currentTurn.hold1 ? currentTurn.dice1 : newDice[0],
        dice2: currentTurn.hold2 ? currentTurn.dice2 : newDice[1],
        dice3: currentTurn.hold3 ? currentTurn.dice3 : newDice[2],
        dice4: currentTurn.hold4 ? currentTurn.dice4 : newDice[3],
        dice5: currentTurn.hold5 ? currentTurn.dice5 : newDice[4],
        rollCount: currentTurn.rollCount + 1,
      });

      // Broadcast turn update
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastGameUpdate(req.params.id);
      }

      res.json(updatedTurn);
    } catch (error) {
      console.error("Roll dice error:", error);
      res.status(500).json({ message: "Failed to roll dice" });
    }
  });

  app.post("/api/games/:id/hold-dice", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const { diceIndex, hold } = req.body;
      
      if (diceIndex < 0 || diceIndex > 4) {
        return res.status(400).json({ message: "Invalid dice index" });
      }

      const game = await storage.getGame(req.params.id);
      if (!game || game.status !== "running") {
        return res.status(400).json({ message: "Game not running" });
      }

      if (game.currentTurnPlayerId !== whopUser.id) {
        return res.status(403).json({ message: "Not your turn" });
      }

      const currentTurn = await storage.getCurrentYahtzeeTurn(req.params.id, whopUser.id);
      if (!currentTurn) {
        return res.status(404).json({ message: "No active turn found" });
      }

      // Update hold status for the specific die
      const holdFields = ['hold1', 'hold2', 'hold3', 'hold4', 'hold5'];
      const updates = { [holdFields[diceIndex]]: hold };
      
      const updatedTurn = await storage.updateYahtzeeTurn(currentTurn.id, updates);
      res.json(updatedTurn);
    } catch (error) {
      res.status(500).json({ message: "Failed to hold dice" });
    }
  });

  const httpServer = createServer(app);
  
  // Setup WebSocket server
  setupWebSocket(httpServer);
  
  // ==================== INSTANT GAMES: PLINKO ====================
  app.post("/api/games/plinko/play", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const { betAmount } = req.body;
      
      // SECURITY: Strict server-side bet validation with exact comparison
      const bet = parseFloat(betAmount);
      const validBets = [0.25, 0.50, 1.00, 2.00, 5.00];
      if (isNaN(bet) || !validBets.some(valid => Math.abs(valid - bet) < 0.001)) {
        return res.status(400).json({ message: "Invalid bet amount" });
      }

      // Get user and check balance
      const user = await storage.getUser(whopUser.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (parseFloat(user.balance) < bet) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Plinko configuration with proper house edge
      // 10 slots with multipliers and probabilities designed for ~95% RTP (5% house edge)
      // RTP calculation: Σ(multiplier[i] * probability[i]) = 0.945
      const slots = [
        { multiplier: 5.0, probability: 0.005 },   // Slot 0 (edge - very rare, high reward)
        { multiplier: 2.5, probability: 0.03 },    // Slot 1
        { multiplier: 1.5, probability: 0.08 },    // Slot 2
        { multiplier: 1.0, probability: 0.12 },    // Slot 3
        { multiplier: 0.5, probability: 0.265 },   // Slot 4 (most common, low mult)
        { multiplier: 0.5, probability: 0.265 },   // Slot 5 (most common, low mult)
        { multiplier: 1.0, probability: 0.12 },    // Slot 6
        { multiplier: 1.5, probability: 0.08 },    // Slot 7
        { multiplier: 2.5, probability: 0.03 },    // Slot 8
        { multiplier: 5.0, probability: 0.005 },   // Slot 9 (edge - very rare, high reward)
      ];
      
      // Verify RTP is ~95% (for transparency)
      const expectedRTP = slots.reduce((sum, slot) => sum + slot.multiplier * slot.probability, 0);
      logger.info(`Plinko RTP: ${(expectedRTP * 100).toFixed(2)}%`);
      
      // Select slot based on weighted probabilities (proper house edge)
      const random = Math.random();
      let cumulativeProbability = 0;
      let slotIndex = 4; // Default to middle
      
      for (let i = 0; i < slots.length; i++) {
        cumulativeProbability += slots[i].probability;
        if (random <= cumulativeProbability) {
          slotIndex = i;
          break;
        }
      }
      
      // Get multiplier for selected slot
      const multiplier = slots[slotIndex].multiplier;
      const winAmount = bet * multiplier;
      
      // Calculate new balance and stats
      const newBalance = (parseFloat(user.balance) - bet + winAmount).toFixed(2);
      const netProfit = winAmount - bet;
      const isWin = netProfit > 0;
      const newGamesPlayed = user.gamesPlayed + 1;
      const newGamesWon = isWin ? user.gamesWon + 1 : user.gamesWon;
      const profitToAdd = netProfit > 0 ? netProfit : 0;
      const newTotalWinnings = (parseFloat(user.totalWinnings) + profitToAdd).toFixed(2);
      
      // Batch all operations into single Firebase transaction for speed
      const { transaction, gameResult: result } = await storage.batchGamePlay(
        whopUser.id,
        'plinko',
        user,
        newBalance,
        {
          userId: whopUser.id,
          type: "plinko",
          amount: (winAmount - bet).toFixed(2),
          description: `Plinko: Bet $${bet.toFixed(2)}, Won $${winAmount.toFixed(2)} (${multiplier}x)`,
          balanceAfter: newBalance,
        },
        {
          userId: whopUser.id,
          betAmount: bet.toFixed(2),
          multiplier: multiplier.toFixed(2),
          winAmount: winAmount.toFixed(2),
          slotIndex,
          balanceAfter: newBalance,
        },
        newGamesPlayed,
        newGamesWon,
        newTotalWinnings
      );
      
      // Send real-time balance update via WebSocket
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.sendBalanceUpdate(whopUser.id);
      }
      
      res.json({
        result,
        newBalance,
        slotIndex,
        multiplier,
        winAmount,
      });
    } catch (error) {
      logger.error("Plinko play error:", error);
      res.status(500).json({ message: "Failed to play Plinko" });
    }
  });

  // Get user's Plinko history
  app.get("/api/games/plinko/history", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const results = await storage.getUserPlinkoResults(whopUser.id, limit);
      res.json(results);
    } catch (error) {
      logger.error("Plinko history error:", error);
      res.status(500).json({ message: "Failed to fetch Plinko history" });
    }
  });

  // ==================== INSTANT GAMES: DICE ====================
  app.post("/api/games/dice/play", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const { betAmount, targetNumber, rollType } = req.body;
      
      // SECURITY: Strict server-side validation
      const bet = parseFloat(betAmount);
      const validBets = [0.25, 0.50, 1.00, 2.00, 5.00];
      if (isNaN(bet) || !validBets.some(valid => Math.abs(valid - bet) < 0.001)) {
        return res.status(400).json({ message: "Invalid bet amount" });
      }

      const target = parseInt(targetNumber);
      if (isNaN(target) || target < 1 || target > 99) {
        return res.status(400).json({ message: "Target number must be between 1 and 99" });
      }

      if (rollType !== "over" && rollType !== "under") {
        return res.status(400).json({ message: "Roll type must be 'over' or 'under'" });
      }

      // Get user and check balance
      const user = await storage.getUser(whopUser.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (parseFloat(user.balance) < bet) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Roll the dice (1-100)
      const rolledNumber = Math.floor(Math.random() * 100) + 1;
      
      // Determine if win
      const isWin = rollType === "over" 
        ? rolledNumber > target 
        : rolledNumber < target;

      // Calculate multiplier with 96% RTP (4% house edge)
      // Win probability for "under X" = X/100
      // Win probability for "over X" = (100-X)/100
      // Multiplier = (1/probability) * 0.96
      const winProbability = rollType === "under" 
        ? target / 100 
        : (100 - target) / 100;
      
      const multiplier = isWin ? (1 / winProbability) * 0.96 : 0;
      const winAmount = isWin ? bet * multiplier : 0;

      // Calculate new balance and stats
      const balanceChange = winAmount - bet;
      const newBalance = (parseFloat(user.balance) + balanceChange).toFixed(2);
      const isProfitable = balanceChange > 0;
      const newGamesPlayed = user.gamesPlayed + 1;
      const newGamesWon = isProfitable ? user.gamesWon + 1 : user.gamesWon;
      const profitToAdd = balanceChange > 0 ? balanceChange : 0;
      const newTotalWinnings = (parseFloat(user.totalWinnings) + profitToAdd).toFixed(2);
      
      // Batch all operations into single Firebase transaction for speed
      const { transaction, gameResult: result } = await storage.batchGamePlay(
        whopUser.id,
        'dice',
        user,
        newBalance,
        {
          userId: whopUser.id,
          type: "dice",
          amount: balanceChange.toFixed(2),
          description: `Dice: Bet $${bet.toFixed(2)}, Rolled ${rolledNumber} (${rollType} ${target}) - ${isWin ? 'WIN' : 'LOSS'}`,
          balanceAfter: newBalance,
        },
        {
          userId: whopUser.id,
          betAmount: bet.toFixed(2),
          targetNumber: target,
          rollType,
          rolledNumber,
          multiplier: multiplier.toFixed(2),
          winAmount: winAmount.toFixed(2),
          won: isWin,
          balanceAfter: newBalance,
        },
        newGamesPlayed,
        newGamesWon,
        newTotalWinnings
      );

      // Send real-time balance update via WebSocket
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.sendBalanceUpdate(whopUser.id);
      }

      res.json({
        result,
        newBalance,
        rolledNumber,
        isWin,
        multiplier,
        winAmount,
      });
    } catch (error) {
      logger.error("Dice play error:", error);
      res.status(500).json({ message: "Failed to play Dice" });
    }
  });

  // Get user's Dice history
  app.get("/api/games/dice/history", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const results = await storage.getUserDiceResults(whopUser.id, limit);
      res.json(results);
    } catch (error) {
      logger.error("Dice history error:", error);
      res.status(500).json({ message: "Failed to fetch Dice history" });
    }
  });

  // ==================== INSTANT GAMES: SLOTS ====================
  app.post("/api/games/slots/play", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const { betAmount } = req.body;
      
      // SECURITY: Strict server-side bet validation
      const bet = parseFloat(betAmount);
      const validBets = [0.25, 0.50, 1.00, 2.00, 5.00];
      if (isNaN(bet) || !validBets.some(valid => Math.abs(valid - bet) < 0.001)) {
        return res.status(400).json({ message: "Invalid bet amount" });
      }

      // Get user and check balance
      const user = await storage.getUser(whopUser.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (parseFloat(user.balance) < bet) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Slots configuration with 95% RTP (5% house edge)
      // 3 reels, 7 symbols each
      const symbols = ["🍒", "🍋", "🍊", "🍇", "💎", "7️⃣", "⭐"];
      const symbolWeights = {
        "🍒": 30,  // Most common
        "🍋": 25,
        "🍊": 20,
        "🍇": 15,
        "💎": 7,   // Rare
        "7️⃣": 2,   // Very rare
        "⭐": 10,
      };

      // Payout multipliers for 3 matching symbols (TUNED for 95% RTP)
      const payouts3Match: Record<string, number> = {
        "7️⃣": 537,   // Jackpot
        "💎": 213,   // Big win
        "⭐": 83,    // Nice win
        "🍇": 44,
        "🍊": 28,
        "🍋": 17,
        "🍒": 11,
      };

      // Payout multipliers for 2 matching symbols (any position)
      const payouts2Match: Record<string, number> = {
        "🍒": 0.5,
        "🍋": 0.3,
        "🍊": 0.2,
      };

      // Weighted random selection function
      const selectSymbol = () => {
        const totalWeight = Object.values(symbolWeights).reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;
        
        for (const [symbol, weight] of Object.entries(symbolWeights)) {
          random -= weight;
          if (random <= 0) {
            return symbol;
          }
        }
        return "🍒"; // Fallback
      };

      // Spin the reels
      const reels = [selectSymbol(), selectSymbol(), selectSymbol()];

      // Check for wins (3-of-a-kind or 2-of-a-kind)
      let multiplier = 0;
      let matchType = "none";
      
      if (reels[0] === reels[1] && reels[1] === reels[2]) {
        // All 3 match
        multiplier = payouts3Match[reels[0]];
        matchType = "3-match";
      } else {
        // Check for 2 matches
        const counts: Record<string, number> = {};
        reels.forEach(symbol => {
          counts[symbol] = (counts[symbol] || 0) + 1;
        });
        
        for (const [symbol, count] of Object.entries(counts)) {
          if (count === 2 && payouts2Match[symbol]) {
            multiplier = payouts2Match[symbol];
            matchType = "2-match";
            break;
          }
        }
      }
      
      const isWin = multiplier > 0;
      const winAmount = isWin ? bet * multiplier : 0;

      // Calculate new balance and stats
      const balanceChange = winAmount - bet;
      const newBalance = (parseFloat(user.balance) + balanceChange).toFixed(2);
      const isProfitable = balanceChange > 0;
      const newGamesPlayed = user.gamesPlayed + 1;
      const newGamesWon = isProfitable ? user.gamesWon + 1 : user.gamesWon;
      const profitToAdd = balanceChange > 0 ? balanceChange : 0;
      const newTotalWinnings = (parseFloat(user.totalWinnings) + profitToAdd).toFixed(2);
      
      // Batch all operations into single Firebase transaction for speed
      const { transaction, gameResult: result } = await storage.batchGamePlay(
        whopUser.id,
        'slots',
        user,
        newBalance,
        {
          userId: whopUser.id,
          type: "slots",
          amount: balanceChange.toFixed(2),
          description: `Slots: Bet $${bet.toFixed(2)}, Reels [${reels.join(' ')}] - ${isWin ? `WIN ${multiplier}x` : 'LOSS'}`,
          balanceAfter: newBalance,
        },
        {
          userId: whopUser.id,
          betAmount: bet.toFixed(2),
          reels: JSON.stringify(reels),
          multiplier: multiplier.toFixed(2),
          winAmount: winAmount.toFixed(2),
          won: isWin,
          balanceAfter: newBalance,
        },
        newGamesPlayed,
        newGamesWon,
        newTotalWinnings
      );

      // Send real-time balance update via WebSocket
      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.sendBalanceUpdate(whopUser.id);
      }

      res.json({
        result,
        newBalance,
        reels,
        isWin,
        multiplier,
        winAmount,
      });
    } catch (error) {
      logger.error("Slots play error:", error);
      res.status(500).json({ message: "Failed to play Slots" });
    }
  });

  // Get user's Slots history
  app.get("/api/games/slots/history", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const results = await storage.getUserSlotsResults(whopUser.id, limit);
      res.json(results);
    } catch (error) {
      logger.error("Slots history error:", error);
      res.status(500).json({ message: "Failed to fetch Slots history" });
    }
  });

  // Chess API endpoints
  app.get("/api/games/:id/chess-state", requireWhopAuth, async (req, res) => {
    try {
      const game = await storage.getGame(req.params.id);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      if (game.gameType !== "chess") {
        return res.status(400).json({ message: "Not a chess game" });
      }

      let chessState = await storage.getChessGameState(req.params.id);
      
      // Auto-repair: If chess state is missing but game exists with participants, initialize it
      if (!chessState) {
        const participants = await storage.getGameParticipants(req.params.id);
        if (participants.length >= 2) {
          logger.info(`🔧 Auto-repairing missing chess state for game ${req.params.id}`);
          await initializeChessGame(req.params.id);
          chessState = await storage.getChessGameState(req.params.id);
        }
        
        if (!chessState) {
          return res.status(404).json({ message: "Chess game state not found" });
        }
      }

      const participants = await storage.getGameParticipants(req.params.id);
      const playersWithInfo = await Promise.all(
        participants.map(async (participant) => {
          const user = await storage.getUser(participant.userId);
          return {
            userId: participant.userId,
            username: user?.username || "Unknown",
            profileImageUrl: user?.profileImageUrl,
            color: participant.userId === chessState.whitePlayerId ? 'white' : 'black'
          };
        })
      );

      const moves = await storage.getChessMoves(req.params.id);
      const movesWithNotation = moves.map(move => ({
        ...move,
        notation: move.algebraicNotation
      }));

      res.json({
        game,
        chessState: {
          ...chessState,
          boardState: JSON.parse(chessState.boardState),
          capturedPieces: chessState.capturedPieces ? JSON.parse(chessState.capturedPieces) : []
        },
        players: playersWithInfo,
        moves: movesWithNotation
      });
    } catch (error) {
      console.error("Failed to fetch chess game state:", error);
      res.status(500).json({ message: "Failed to fetch game state" });
    }
  });

  app.post("/api/games/:id/chess/make-move", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const { from, to, promotion } = req.body;
      
      if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
        return res.status(400).json({ message: "Invalid move format: 'from' and 'to' squares are required" });
      }

      if (promotion && !['queen', 'rook', 'bishop', 'knight'].includes(promotion)) {
        return res.status(400).json({ message: "Invalid promotion piece" });
      }
      
      const game = await storage.getGame(req.params.id);
      if (!game || game.status !== "running") {
        return res.status(400).json({ message: "Game not running" });
      }

      if (game.gameType !== "chess") {
        return res.status(400).json({ message: "Not a chess game" });
      }

      const chessState = await storage.getChessGameState(req.params.id);
      if (!chessState) {
        return res.status(404).json({ message: "Chess game state not found" });
      }

      const currentPlayerColor = chessState.currentTurn as 'white' | 'black';
      const currentPlayerId = currentPlayerColor === 'white' ? chessState.whitePlayerId : chessState.blackPlayerId;

      if (currentPlayerId !== whopUser.id) {
        return res.status(403).json({ message: "Not your turn" });
      }

      const board = JSON.parse(chessState.boardState);
      const fromPos = squareToPosition(from);
      const toPos = squareToPosition(to);

      const moveResult = validateMove(
        board,
        { from: fromPos, to: toPos, promotion },
        currentPlayerColor,
        {
          whiteKingside: chessState.whiteKingsideCastle || false,
          whiteQueenside: chessState.whiteQueensideCastle || false,
          blackKingside: chessState.blackKingsideCastle || false,
          blackQueenside: chessState.blackQueensideCastle || false
        },
        chessState.enPassantTarget
      );

      if (!moveResult.valid) {
        return res.status(400).json({ message: moveResult.error || "Invalid move" });
      }

      const piece = board[fromPos.row][fromPos.col];
      const newBoard = JSON.parse(chessState.boardState);
      newBoard[toPos.row][toPos.col] = promotion ? { type: promotion, color: piece.color } : piece;
      newBoard[fromPos.row][fromPos.col] = null;

      if (moveResult.isEnPassant) {
        newBoard[fromPos.row][toPos.col] = null;
      }

      const capturedPieces = chessState.capturedPieces ? JSON.parse(chessState.capturedPieces) : [];
      if (moveResult.capturedPiece) {
        capturedPieces.push(moveResult.capturedPiece);
      }

      const newEnPassantTarget = getEnPassantTarget(fromPos, toPos, piece);
      const newCastlingRights = updateCastlingRights(fromPos, piece, {
        whiteKingside: chessState.whiteKingsideCastle || false,
        whiteQueenside: chessState.whiteQueensideCastle || false,
        blackKingside: chessState.blackKingsideCastle || false,
        blackQueenside: chessState.blackQueensideCastle || false
      });

      const nextTurn = currentPlayerColor === 'white' ? 'black' : 'white';
      const gameStatus = moveResult.isCheckmate ? 'checkmate' : moveResult.isStalemate ? 'stalemate' : 'in_progress';

      await storage.updateChessGameState(req.params.id, {
        boardState: JSON.stringify(newBoard),
        currentTurn: nextTurn,
        gameStatus,
        enPassantTarget: newEnPassantTarget,
        moveCount: chessState.moveCount + 1,
        capturedPieces: JSON.stringify(capturedPieces),
        whiteKingsideCastle: newCastlingRights.whiteKingside,
        whiteQueensideCastle: newCastlingRights.whiteQueenside,
        blackKingsideCastle: newCastlingRights.blackKingside,
        blackQueensideCastle: newCastlingRights.blackQueenside
      });

      const notation = getMoveNotation(
        board,
        fromPos,
        toPos,
        !!moveResult.capturedPiece,
        moveResult.isCheck,
        moveResult.isCheckmate,
        !!moveResult.isCastling,
        promotion
      );

      await storage.createChessMove({
        gameId: req.params.id,
        moveNumber: chessState.moveCount + 1,
        playerId: whopUser.id,
        playerColor: currentPlayerColor,
        fromSquare: from,
        toSquare: to,
        piece: piece.type,
        capturedPiece: moveResult.capturedPiece?.type || null,
        isCheck: moveResult.isCheck,
        isCheckmate: moveResult.isCheckmate,
        isCastling: moveResult.isCastling || false,
        isEnPassant: moveResult.isEnPassant || false,
        promotion: promotion || null,
        algebraicNotation: notation
      });

      if (moveResult.isCheckmate) {
        await storage.updateGameStatus(req.params.id, "completed", whopUser.id);
        await completeChessGame(req.params.id, whopUser.id);
      }

      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastGameUpdate(req.params.id);
      }

      res.json({
        success: true,
        moveResult,
        notation
      });
    } catch (error) {
      console.error("Make move error:", error);
      res.status(500).json({ message: "Failed to make move" });
    }
  });

  app.get("/api/games/:id/chess/valid-moves/:square", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const square = req.params.square;
      
      const game = await storage.getGame(req.params.id);
      if (!game || game.status !== "running") {
        return res.status(400).json({ message: "Game not running" });
      }

      if (game.gameType !== "chess") {
        return res.status(400).json({ message: "Not a chess game" });
      }

      const chessState = await storage.getChessGameState(req.params.id);
      if (!chessState) {
        return res.status(404).json({ message: "Chess game state not found" });
      }

      const currentPlayerColor = chessState.currentTurn as 'white' | 'black';
      const currentPlayerId = currentPlayerColor === 'white' ? chessState.whitePlayerId : chessState.blackPlayerId;

      if (currentPlayerId !== whopUser.id) {
        return res.json({ validMoves: [] });
      }

      const board = JSON.parse(chessState.boardState);
      const fromPos = squareToPosition(square);
      const piece = board[fromPos.row][fromPos.col];

      if (!piece || piece.color !== currentPlayerColor) {
        return res.json({ validMoves: [] });
      }

      const validMoves: string[] = [];
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

      for (const rank of ranks) {
        for (const file of files) {
          const toSquare = `${file}${rank}`;
          const toPos = squareToPosition(toSquare);
          
          const isPromotionMove = piece.type === 'pawn' && 
            ((piece.color === 'white' && toPos.row === 0) || 
             (piece.color === 'black' && toPos.row === 7));
          
          if (isPromotionMove) {
            const promotionTypes: ChessPieceType[] = ['queen', 'rook', 'bishop', 'knight'];
            for (const promotionType of promotionTypes) {
              const moveResult = validateMove(
                board,
                { from: fromPos, to: toPos, promotion: promotionType },
                currentPlayerColor,
                {
                  whiteKingside: chessState.whiteKingsideCastle || false,
                  whiteQueenside: chessState.whiteQueensideCastle || false,
                  blackKingside: chessState.blackKingsideCastle || false,
                  blackQueenside: chessState.blackQueensideCastle || false
                },
                chessState.enPassantTarget
              );

              if (moveResult.valid) {
                validMoves.push(toSquare);
                break;
              }
            }
          } else {
            const moveResult = validateMove(
              board,
              { from: fromPos, to: toPos },
              currentPlayerColor,
              {
                whiteKingside: chessState.whiteKingsideCastle || false,
                whiteQueenside: chessState.whiteQueensideCastle || false,
                blackKingside: chessState.blackKingsideCastle || false,
                blackQueenside: chessState.blackQueensideCastle || false
              },
              chessState.enPassantTarget
            );

            if (moveResult.valid) {
              validMoves.push(toSquare);
            }
          }
        }
      }

      res.json({ validMoves });
    } catch (error) {
      console.error("Get valid moves error:", error);
      res.status(500).json({ message: "Failed to get valid moves" });
    }
  });

  app.post("/api/games/:id/chess/resign", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      const game = await storage.getGame(req.params.id);
      if (!game || game.status !== "running") {
        return res.status(400).json({ message: "Game not running" });
      }

      if (game.gameType !== "chess") {
        return res.status(400).json({ message: "Not a chess game" });
      }

      const chessState = await storage.getChessGameState(req.params.id);
      if (!chessState) {
        return res.status(404).json({ message: "Chess game state not found" });
      }

      const isWhite = chessState.whitePlayerId === whopUser.id;
      const isBlack = chessState.blackPlayerId === whopUser.id;

      if (!isWhite && !isBlack) {
        return res.status(403).json({ message: "You are not a player in this game" });
      }

      const winnerId = isWhite ? chessState.blackPlayerId : chessState.whitePlayerId;

      await storage.updateChessGameState(req.params.id, {
        gameStatus: 'resigned'
      });

      await storage.updateGameStatus(req.params.id, "completed", winnerId);
      await completeChessGame(req.params.id, winnerId);

      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastWinnerAnnouncement(req.params.id, winnerId);
        await wsServer.broadcastGameUpdate(req.params.id);
      }

      res.json({ success: true, winnerId });
    } catch (error) {
      console.error("Resign error:", error);
      res.status(500).json({ message: "Failed to resign" });
    }
  });

  async function completeChessGame(gameId: string, winnerId: string) {
    try {
      const game = await storage.getGame(gameId);
      if (!game) return;

      const participants = await storage.getGameParticipants(gameId);
      const winnerParticipant = participants.find(p => p.userId === winnerId);
      const loserParticipant = participants.find(p => p.userId !== winnerId);

      if (!winnerParticipant || !loserParticipant) return;

      const entryFee = parseFloat(game.entryFee);
      const prizeAmount = parseFloat(game.prizeAmount);
      const commissionRate = 0.10;
      const commissionAmount = prizeAmount * commissionRate;
      const winnerPayout = prizeAmount - commissionAmount;

      const winner = await storage.getUser(winnerId);
      if (winner) {
        const newBalance = (parseFloat(winner.balance) + winnerPayout).toFixed(2);
        await storage.updateUserBalance(winnerId, newBalance);
        await storage.updateUserStats(
          winnerId,
          winner.gamesPlayed + 1,
          winner.gamesWon + 1,
          (parseFloat(winner.totalWinnings) + winnerPayout).toFixed(2)
        );

        await storage.createTransaction({
          userId: winnerId,
          type: "win",
          amount: winnerPayout.toFixed(2),
          description: `${game.name} - Winner Prize`,
          gameId,
          balanceAfter: newBalance,
        });
      }

      const loser = await storage.getUser(loserParticipant.userId);
      if (loser) {
        await storage.updateUserStats(
          loserParticipant.userId,
          loser.gamesPlayed + 1,
          loser.gamesWon,
          loser.totalWinnings
        );
      }

      await storage.saveMatchResult(
        {
          gameId,
          winnerId,
          prizeAmount: prizeAmount.toFixed(2),
        },
        [
          {
            userId: winnerId,
            username: winner?.username || "Winner",
            totalScore: 1,
            rank: 1,
            entryFee: entryFee.toFixed(2),
            netChange: winnerPayout.toFixed(2),
            forfeited: false
          },
          {
            userId: loserParticipant.userId,
            username: loser?.username || "Loser",
            totalScore: 0,
            rank: 2,
            entryFee: entryFee.toFixed(2),
            netChange: (-entryFee).toFixed(2),
            forfeited: false
          }
        ]
      );

      if (commissionAmount > 0) {
        await processCommission(commissionAmount, gameId);
        
        await storage.createTransaction({
          userId: "platform",
          type: "commission",
          amount: commissionAmount.toFixed(2),
          description: `${game.name} - Platform Commission`,
          gameId,
          balanceAfter: "0.00",
        });
      }

      // If this game is part of a tournament, mark the tournament as completed
      if (game.tournamentId) {
        try {
          await storage.updateTournamentStatus(game.tournamentId, "completed");
          logger.info(`Marked tournament ${game.tournamentId} as completed after chess game ${gameId} finished`);
        } catch (tournamentError) {
          logger.error(`Failed to update tournament status for ${game.tournamentId}:`, tournamentError);
        }
      }

      const wsServer = getWebSocketServer();
      if (wsServer) {
        await wsServer.broadcastWinnerAnnouncement(gameId, winnerId);
        await wsServer.broadcastGameUpdate(gameId);
      }
    } catch (error) {
      console.error("Error completing chess game:", error);
    }
  }

  // Tournament management endpoints
  app.post("/api/tournaments", requireWhopAuth, requireAdminAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      // Validate input with schema
      const validatedData = insertTournamentSchema.parse({
        gameType: req.body.gameType,
        hostedBy: whopUser.id,
        companyId: req.body.companyId,
        experienceId: req.body.experienceId,
        potAmount: req.body.potAmount,
        entryFee: req.body.entryFee,
        maxParticipants: req.body.maxParticipants || 10,
        name: req.body.name,
        description: req.body.description,
      });
      
      // Create tournament
      const tournament = await storage.createTournament(validatedData);
      
      res.json(tournament);
    } catch (error) {
      console.error("Create tournament error:", error);
      if (error instanceof Error && error.message.includes('validation')) {
        return res.status(400).json({ message: "Invalid tournament data", error: error.message });
      }
      res.status(500).json({ message: "Failed to create tournament" });
    }
  });

  // Send notification to company team members about a tournament
  app.post("/api/tournaments/:id/notify", requireWhopAuth, async (req, res) => {
    logger.info(`🔔 [NOTIFY] Starting notification request for tournament ${req.params.id}`);
    
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const tournamentId = req.params.id;
      
      logger.info(`🔔 [NOTIFY] User: ${whopUser.id}, Tournament ID: ${tournamentId}`);
      
      const tournament = await storage.getTournament(tournamentId);
      logger.info(`🔔 [NOTIFY] Tournament fetched:`, JSON.stringify({
        id: tournament?.id,
        name: tournament?.name,
        companyId: tournament?.companyId,
        experienceId: tournament?.experienceId,
      }));
      
      if (!tournament) {
        logger.error(`🔔 [NOTIFY] Tournament not found: ${tournamentId}`);
        return res.status(404).json({ message: "Tournament not found" });
      }

      // Check if notification was already sent
      if (tournament.notificationSent) {
        logger.warn(`🔔 [NOTIFY] ⚠️ Notification already sent for tournament ${tournamentId} at ${tournament.notificationSentAt}`);
        return res.status(400).json({ 
          message: "Notification already sent for this tournament",
          notificationSentAt: tournament.notificationSentAt
        });
      }

      // Verify the tournament has a companyId or experienceId for admin check
      const resourceId = tournament.companyId || tournament.experienceId;
      logger.info(`🔔 [NOTIFY] Resource ID for admin check: ${resourceId}`);
      
      if (!resourceId) {
        logger.error(`🔔 [NOTIFY] No resourceId found for tournament ${tournamentId}`);
        return res.status(400).json({ message: "Tournament must be associated with a company or experience" });
      }

      // Check if user is admin
      logger.info(`🔔 [NOTIFY] Checking admin access for user ${whopUser.id} on resource ${resourceId}`);
      const accessResult = await whopSdk.access.checkIfUserHasAccessToExperience({
        userId: whopUser.id,
        experienceId: resourceId,
      });
      logger.info(`🔔 [NOTIFY] Access level: ${accessResult.accessLevel}`);

      if (accessResult.accessLevel !== "admin") {
        logger.warn(`🔔 [NOTIFY] 🚫 Non-admin user ${whopUser.id} attempted to send tournament notification`);
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get companyId - either from tournament directly or from the experience
      let companyId = tournament.companyId;
      
      if (!companyId && tournament.experienceId) {
        logger.info(`🔔 [NOTIFY] No companyId, fetching company from experienceId: ${tournament.experienceId}`);
        try {
          // Retrieve the experience to get the company ID
          const experience = await whopSdk.experiences.getExperience({ experienceId: tournament.experienceId });
          companyId = experience.company.id;
          logger.info(`🔔 [NOTIFY] Retrieved company from experience: ${companyId}`);
        } catch (expError) {
          logger.error(`🔔 [NOTIFY] Failed to retrieve company from experience:`, expError);
          return res.status(400).json({ message: "Failed to retrieve company from experience" });
        }
      }
      
      if (!companyId) {
        logger.error(`🔔 [NOTIFY] Tournament ${tournamentId} has no companyId and couldn't retrieve from experience`);
        return res.status(400).json({ message: "Tournament must be associated with a company to notify team members" });
      }

      logger.info(`🔔 [NOTIFY] Using company ID: ${companyId}`);

      const notificationTitle = `New Tournament: ${tournament.name}`;
      const notificationContent = `A new ${tournament.gameType} tournament has been created! Entry fee: $${tournament.entryFee}. Join now and compete for a prize pool of $${tournament.potAmount}!`;
      
      const apiKey = process.env.WHOP_API_KEY;
      if (!apiKey) {
        logger.error(`🔔 [NOTIFY] WHOP_API_KEY not configured`);
        return res.status(500).json({ message: "WHOP_API_KEY not configured" });
      }

      logger.info(`🔔 [NOTIFY] Sending notification to all members`);

      try {
        if (tournament.experienceId) {
          logger.info(`🔔 [NOTIFY] Using experienceId to notify all members: ${tournament.experienceId}`);
          
          const notificationResult = await whopSdk.notifications.sendPushNotification({
            experienceId: tournament.experienceId,
            title: notificationTitle,
            content: notificationContent,
            senderUserId: whopUser.id,
            isMention: true,
          });
          
          logger.info(`🔔 [NOTIFY] ✅ Notification API call completed. Result:`, notificationResult);
          
          if (notificationResult === false || notificationResult === null) {
            logger.warn(`🔔 [NOTIFY] ⚠️ Notification may not have been sent (result was ${notificationResult})`);
          } else {
            // Mark tournament as notified
            await storage.markTournamentAsNotified(tournamentId);
            logger.info(`🔔 [NOTIFY] Tournament marked as notified in database`);
          }
        } else {
          logger.error(`🔔 [NOTIFY] No experienceId found for tournament`);
          return res.status(400).json({ message: "Tournament must have an experienceId to send notifications" });
        }
        
        res.json({ 
          success: true,
          companyId: companyId,
          experienceId: tournament.experienceId
        });
      } catch (notificationError: any) {
        logger.error(`🔔 [NOTIFY] Failed:`, notificationError);
        logger.error(`🔔 [NOTIFY] Error details:`, JSON.stringify(notificationError, null, 2));
        throw notificationError;
      }
    } catch (error) {
      logger.error(`🔔 [NOTIFY] Error:`, error instanceof Error ? error.message : "Unknown error");
      res.status(500).json({ message: "Failed to send notification", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/tournaments", requireWhopAuth, async (req, res) => {
    try {
      const { resourceId } = req.query;
      const tournaments = await storage.getAllTournaments(resourceId as string);
      res.json(tournaments);
    } catch (error) {
      console.error("Get tournaments error:", error);
      res.status(500).json({ message: "Failed to get tournaments" });
    }
  });

  app.get("/api/tournaments/active", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const { resourceId } = req.query;
      const tournaments = await storage.getActiveTournaments(resourceId as string);
      
      // Enhance each tournament with user participation info
      const tournamentsWithParticipation = await Promise.all(
        tournaments.map(async (tournament) => {
          const isParticipant = await storage.isUserInTournament(tournament.id, whopUser.id);
          return {
            ...tournament,
            isParticipant,
          };
        })
      );
      
      res.json(tournamentsWithParticipation);
    } catch (error) {
      console.error("Get active tournaments error:", error);
      res.status(500).json({ message: "Failed to get active tournaments" });
    }
  });
  
  // Get user's active tournament participations
  app.get("/api/user/:id/active-tournaments", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      
      // Only allow users to access their own tournament participations
      if (req.params.id !== whopUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get all active tournaments
      const activeTournaments = await storage.getActiveTournaments();
      
      // Filter to only tournaments the user is participating in
      const userTournaments = [];
      for (const tournament of activeTournaments) {
        const isParticipant = await storage.isUserInTournament(tournament.id, whopUser.id);
        if (isParticipant) {
          userTournaments.push(tournament);
        }
      }
      
      res.json(userTournaments);
    } catch (error) {
      console.error("Get user active tournaments error:", error);
      res.status(500).json({ message: "Failed to get user tournaments" });
    }
  });

  app.put("/api/tournaments/:id/status", requireWhopAuth, requireAdminAuth, async (req, res) => {
    try {
      const { status } = req.body;
      
      // Validate status is one of the allowed values
      const validStatuses = ["active", "started", "completed", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      }
      
      // If status is being changed to "started", actually start the tournament and create the game
      if (status === "started") {
        try {
          const game = await storage.startTournament(req.params.id);
          const tournament = await storage.getTournament(req.params.id);
          console.log(`Admin manually started tournament ${req.params.id}, created game ${game.id}`);
          
          // Initialize the game based on game type
          if (game.gameType === "chess") {
            await initializeChessGame(game.id);
            logger.info(`Initialized chess game ${game.id} for tournament ${req.params.id}`);
          } else if (game.gameType === "yahtzee") {
            await initializeYahtzeeGame(game.id);
            logger.info(`Initialized yahtzee game ${game.id} for tournament ${req.params.id}`);
          }
          
          return res.json({ tournament, gameId: game.id });
        } catch (startError: any) {
          console.error("Manual start tournament error:", startError);
          return res.status(400).json({ message: startError.message || "Failed to start tournament" });
        }
      }
      
      const tournament = await storage.updateTournamentStatus(req.params.id, status);
      res.json(tournament);
    } catch (error) {
      console.error("Update tournament status error:", error);
      res.status(500).json({ message: "Failed to update tournament status" });
    }
  });

  // Tournament participant endpoints
  app.post("/api/tournaments/:id/join", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const tournamentId = req.params.id;
      
      const participant = await storage.joinTournament(tournamentId, whopUser.id);
      const tournament = await storage.getTournament(tournamentId);
      
      // Check if tournament is now full and auto-start it
      if (tournament && tournament.currentParticipants >= tournament.maxParticipants) {
        try {
          const game = await storage.startTournament(tournamentId);
          console.log(`Auto-started tournament ${tournamentId}, created game ${game.id}`);
          
          // Initialize the game based on game type
          if (game.gameType === "chess") {
            await initializeChessGame(game.id);
            logger.info(`Initialized chess game ${game.id} for tournament ${tournamentId}`);
          } else if (game.gameType === "yahtzee") {
            await initializeYahtzeeGame(game.id);
            logger.info(`Initialized yahtzee game ${game.id} for tournament ${tournamentId}`);
          }
          
          return res.json({ participant, tournament: { ...tournament, status: 'started' }, gameId: game.id });
        } catch (startError) {
          console.error("Auto-start tournament error:", startError);
          // Continue even if auto-start fails - return the join success
        }
      }
      
      res.json({ participant, tournament });
    } catch (error: any) {
      console.error("Join tournament error:", error);
      if (error.message === 'Tournament not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Tournament is not active') {
        return res.status(400).json({ message: error.message });
      }
      if (error.message === 'User already joined this tournament') {
        return res.status(409).json({ message: error.message });
      }
      if (error.message === 'Tournament is full') {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to join tournament" });
    }
  });

  app.delete("/api/tournaments/:id/leave", requireWhopAuth, async (req, res) => {
    try {
      const whopUser = (req as any).whopUser as WhopUser;
      const tournamentId = req.params.id;
      
      await storage.leaveTournament(tournamentId, whopUser.id);
      const tournament = await storage.getTournament(tournamentId);
      
      res.json({ success: true, tournament });
    } catch (error: any) {
      console.error("Leave tournament error:", error);
      if (error.message === 'Tournament not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User is not in this tournament') {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to leave tournament" });
    }
  });

  app.get("/api/tournaments/:id", requireWhopAuth, async (req, res) => {
    try {
      const tournamentId = req.params.id;
      const tournament = await storage.getTournament(tournamentId);
      
      if (!tournament) {
        return res.status(404).json({ message: "Tournament not found" });
      }
      
      res.json(tournament);
    } catch (error) {
      console.error("Get tournament error:", error);
      res.status(500).json({ message: "Failed to get tournament" });
    }
  });

  app.get("/api/tournaments/:id/participants", requireWhopAuth, async (req, res) => {
    try {
      const tournamentId = req.params.id;
      const participants = await storage.getTournamentParticipants(tournamentId);
      
      // Enrich participants with user data
      const enrichedParticipants = await Promise.all(
        participants.map(async (participant) => {
          const user = await storage.getUser(participant.userId);
          return {
            ...participant,
            username: user?.username || `Player ${participant.userId.slice(-4)}`,
            profileImageUrl: user?.profileImageUrl || null,
          };
        })
      );
      
      res.json(enrichedParticipants);
    } catch (error) {
      console.error("Get tournament participants error:", error);
      res.status(500).json({ message: "Failed to get tournament participants" });
    }
  });

  app.post("/api/admin/repair-chess-game/:gameId", requireAdminAuth, async (req, res) => {
    try {
      const gameId = req.params.gameId;
      const game = await storage.getGame(gameId);
      
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      if (game.gameType !== "chess") {
        return res.status(400).json({ message: "Not a chess game" });
      }
      
      const existingChessState = await storage.getChessGameState(gameId);
      if (existingChessState) {
        return res.json({ message: "Chess game state already exists", game });
      }
      
      const participants = await storage.getGameParticipants(gameId);
      if (participants.length < 2) {
        return res.status(400).json({ message: "Need at least 2 participants to initialize chess game" });
      }
      
      await initializeChessGame(gameId);
      
      logger.info(`🔧 Repaired chess game ${gameId}`);
      res.json({ success: true, message: "Chess game state initialized successfully", gameId });
    } catch (error: any) {
      logger.error("Failed to repair chess game:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to repair chess game"
      });
    }
  });

  app.get("/api/admin/test-daily-report", async (req, res) => {
    try {
      logger.info('📊 Manual test report triggered via URL');
      await generateAndSendReport();
      res.json({ success: true, message: "Daily report generated and sent successfully! Check your email." });
    } catch (error: any) {
      logger.error("Failed to generate test report:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to generate report. Make sure GEMINI_KEY and RESEND_API_KEY are set in Secrets.",
        error: error.message 
      });
    }
  });

  return httpServer;
}
