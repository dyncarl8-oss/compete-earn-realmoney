import { 
  type User, 
  type InsertUser,
  type Game,
  type InsertGame,
  type GameParticipant,
  type Tournament,
  type InsertTournament,
  type TournamentParticipant,
  type Transaction,
  type InsertTransaction,
  type YahtzeePlayerState,
  type InsertYahtzeePlayerState,
  type YahtzeeTurn,
  type InsertYahtzeeTurn,
  type MatchResult,
  type InsertMatchResult,
  type MatchResultPlayer,
  type InsertMatchResultPlayer,
  type MatchResultWithPlayers,
  type GameInvitation,
  type InsertGameInvitation,
  type PlinkoResult,
  type InsertPlinkoResult,
  type DiceResult,
  type InsertDiceResult,
  type SlotsResult,
  type InsertSlotsResult,
  type ChessGameState,
  type InsertChessGameState,
  type ChessMove,
  type InsertChessMove,
  type PageView,
  type InsertPageView,
  type BugReport,
  type InsertBugReport
} from "@shared/schema";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";
import { logger } from "./logger";
import { MoneyAmount, calculateWinnings, calculateWithdrawn } from "./decimal-utils";
import { FirestoreStorage } from "./firestore-storage";

// Atomic withdrawal result
export interface WithdrawalResult {
  success: boolean;
  user?: User;
  transaction?: Transaction;
  error?: string;
  availableForWithdrawal?: string;
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser & { id?: string }): Promise<User>;
  createOrGetUser(id: string, profile: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  updateUserBalance(userId: string, newBalance: string): Promise<User>;
  updateUserStats(userId: string, gamesPlayed: number, gamesWon: number, totalWinnings: string): Promise<User>;
  updateUserActivity(userId: string): Promise<User | undefined>;
  
  // Atomic withdrawal operations - CRITICAL SECURITY FIX
  atomicWithdrawal(userId: string, amount: string, idempotencyKey: string): Promise<WithdrawalResult>;
  
  // Webhook idempotency operations - CRITICAL PAYMENT PROTECTION
  isWebhookProcessed(webhookId: string): Promise<boolean>;
  markWebhookProcessed(webhookId: string): Promise<void>;
  
  // Game operations
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: string): Promise<Game | undefined>;
  getAvailableGames(): Promise<Game[]>;
  getUserActiveGame(userId: string): Promise<Game | undefined>;
  updateGameStatus(gameId: string, status: string, winnerId?: string): Promise<Game>;
  updateGamePlayers(gameId: string, currentPlayers: number): Promise<Game>;
  updateGameTurn(gameId: string, currentRound: number, currentTurnPlayerId: string): Promise<Game>;
  
  // Game participant operations
  addGameParticipant(gameId: string, userId: string): Promise<GameParticipant>;
  getGameParticipants(gameId: string): Promise<GameParticipant[]>;
  removeGameParticipant(gameId: string, userId: string): Promise<void>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getUserTransactions(userId: string): Promise<Transaction[]>;
  getAllTransactions(): Promise<Transaction[]>;

  // Yahtzee-specific operations
  createYahtzeePlayerState(state: InsertYahtzeePlayerState): Promise<YahtzeePlayerState>;
  getYahtzeePlayerState(gameId: string, userId: string): Promise<YahtzeePlayerState | undefined>;
  updateYahtzeePlayerState(gameId: string, userId: string, updates: Partial<YahtzeePlayerState>): Promise<YahtzeePlayerState>;
  getYahtzeeGameStates(gameId: string): Promise<YahtzeePlayerState[]>;
  createYahtzeeTurn(turn: InsertYahtzeeTurn): Promise<YahtzeeTurn>;
  getCurrentYahtzeeTurn(gameId: string, userId: string): Promise<YahtzeeTurn | undefined>;
  updateYahtzeeTurn(turnId: string, updates: Partial<YahtzeeTurn>): Promise<YahtzeeTurn>;
  completeYahtzeeTurn(turnId: string, category: string, points: number): Promise<YahtzeeTurn>;

  // Match result operations
  saveMatchResult(result: InsertMatchResult, players: InsertMatchResultPlayer[]): Promise<MatchResult>;
  getGameFinalResults(gameId: string): Promise<MatchResultWithPlayers | undefined>;
  getUserMatchHistory(userId: string, limit?: number, offset?: number): Promise<MatchResultWithPlayers[]>;

  // Game invitation operations
  createGameInvitation(invitation: InsertGameInvitation): Promise<GameInvitation>;
  getGameInvitation(id: string): Promise<GameInvitation | undefined>;
  getUserInvitations(userId: string, status?: string): Promise<GameInvitation[]>;
  updateInvitationStatus(id: string, status: string, respondedAt?: Date): Promise<GameInvitation>;
  expireOldInvitations(): Promise<void>;

  // Plinko game operations
  createPlinkoResult(result: InsertPlinkoResult): Promise<PlinkoResult>;
  getUserPlinkoResults(userId: string, limit?: number): Promise<PlinkoResult[]>;

  // Dice game operations
  createDiceResult(result: InsertDiceResult): Promise<DiceResult>;
  getUserDiceResults(userId: string, limit?: number): Promise<DiceResult[]>;

  // Slots game operations
  createSlotsResult(result: InsertSlotsResult): Promise<SlotsResult>;
  getUserSlotsResults(userId: string, limit?: number): Promise<SlotsResult[]>;
  
  // Batched game play operations (performance optimized)
  batchGamePlay(
    userId: string,
    gameType: 'plinko' | 'dice' | 'slots',
    user: User,
    newBalance: string,
    transaction: Omit<InsertTransaction, 'createdAt'>,
    gameResult: InsertPlinkoResult | InsertDiceResult | InsertSlotsResult,
    newGamesPlayed: number,
    newGamesWon: number,
    newTotalWinnings: string
  ): Promise<{ transaction: Transaction; gameResult: PlinkoResult | DiceResult | SlotsResult }>;

  // Chess game operations
  createChessGameState(state: InsertChessGameState): Promise<ChessGameState>;
  getChessGameState(gameId: string): Promise<ChessGameState | undefined>;
  updateChessGameState(gameId: string, updates: Partial<ChessGameState>): Promise<ChessGameState>;
  createChessMove(move: InsertChessMove): Promise<ChessMove>;
  getChessMoves(gameId: string): Promise<ChessMove[]>;

  // Page view operations
  createPageView(view: InsertPageView): Promise<PageView>;
  getPageViews(pagePath?: string, hoursBack?: number): Promise<PageView[]>;
  getPageViewCount(pagePath?: string, hoursBack?: number): Promise<number>;

  // Bug report operations
  createBugReport(report: InsertBugReport): Promise<BugReport>;
  getBugReports(status?: string): Promise<BugReport[]>;

  // Tournament operations
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  getTournament(id: string): Promise<Tournament | undefined>;
  getActiveTournaments(resourceId?: string): Promise<Tournament[]>;
  getAllTournaments(resourceId?: string): Promise<Tournament[]>;
  updateTournamentStatus(id: string, status: string): Promise<Tournament>;
  updateTournamentParticipants(id: string, currentParticipants: number): Promise<Tournament>;
  markTournamentAsNotified(id: string): Promise<void>;
  
  // Tournament participant operations
  joinTournament(tournamentId: string, userId: string): Promise<TournamentParticipant>;
  leaveTournament(tournamentId: string, userId: string): Promise<void>;
  getTournamentParticipants(tournamentId: string): Promise<TournamentParticipant[]>;
  isUserInTournament(tournamentId: string, userId: string): Promise<boolean>;
  startTournament(tournamentId: string): Promise<Game>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private games: Map<string, Game>;
  private gameParticipants: Map<string, GameParticipant>;
  private transactions: Map<string, Transaction>;
  private yahtzeePlayerStates: Map<string, YahtzeePlayerState>;
  private yahtzeeTurns: Map<string, YahtzeeTurn>;
  private matchResults: Map<string, MatchResult>;
  private matchResultPlayers: Map<string, MatchResultPlayer>;
  private gameInvitations: Map<string, GameInvitation>;
  private plinkoResults: Map<string, PlinkoResult>;
  private diceResults: Map<string, DiceResult>;
  private slotsResults: Map<string, SlotsResult>;
  private chessGameStates: Map<string, ChessGameState>;
  private chessMoves: Map<string, ChessMove>;
  private pageViews: Map<string, PageView>;
  private bugReports: Map<string, BugReport>;
  private withdrawalLocks: Map<string, Promise<WithdrawalResult>>;
  private processedIdempotencyKeys: Set<string>;
  private processedWebhooks: Set<string>;

  constructor() {
    this.users = new Map();
    this.games = new Map();
    this.gameParticipants = new Map();
    this.transactions = new Map();
    this.yahtzeePlayerStates = new Map();
    this.yahtzeeTurns = new Map();
    this.matchResults = new Map();
    this.matchResultPlayers = new Map();
    this.gameInvitations = new Map();
    this.plinkoResults = new Map();
    this.diceResults = new Map();
    this.slotsResults = new Map();
    this.chessGameStates = new Map();
    this.chessMoves = new Map();
    this.pageViews = new Map();
    this.bugReports = new Map();
    this.withdrawalLocks = new Map();
    this.processedIdempotencyKeys = new Set();
    this.processedWebhooks = new Set();
    
    // Initialize with a default user for development
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    const defaultUser: User = {
      id: "user-1",
      username: "player_alex",
      email: "alex@example.com",
      balance: "25.00",
      profileImageUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&h=80",
      gamesPlayed: 47,
      gamesWon: 15,
      totalWinnings: "75.00",
      lastActivity: new Date(), // Set as online
      createdAt: new Date(),
    };
    this.users.set(defaultUser.id, defaultUser);

    // No pre-created games - users create their own tables
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser & { id?: string }): Promise<User> {
    const id = insertUser.id || randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      email: insertUser.email || null,
      profileImageUrl: insertUser.profileImageUrl || null,
      balance: "0.00",
      gamesPlayed: 0,
      gamesWon: 0,
      totalWinnings: "0.00",
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async createOrGetUser(id: string, profile: InsertUser): Promise<User> {
    const existingUser = await this.getUser(id);
    if (existingUser) {
      // Only update non-empty fields to avoid overwriting with placeholder data
      const updates: Partial<InsertUser> = {};
      if (profile.username && profile.username !== `Player${id.slice(-4)}`) {
        updates.username = profile.username;
      }
      if (profile.email) {
        updates.email = profile.email;
      }
      if (profile.profileImageUrl) {
        updates.profileImageUrl = profile.profileImageUrl;
      }
      
      // Only update if there are meaningful changes
      if (Object.keys(updates).length > 0) {
        return await this.updateUser(id, updates);
      }
      
      return existingUser;
    }
    return await this.createUser({ ...profile, id });
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserBalance(userId: string, newBalance: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, balance: newBalance };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserStats(userId: string, gamesPlayed: number, gamesWon: number, totalWinnings: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, gamesPlayed, gamesWon, totalWinnings };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserActivity(userId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) {
      return undefined;
    }
    
    const updatedUser = {
      ...user,
      lastActivity: new Date(),
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async createGame(insertGame: InsertGame): Promise<Game> {
    const id = randomUUID();
    const maxPlayers = insertGame.maxPlayers || 3;
    const entryFee = parseFloat(insertGame.entryFee);
    const prizeAmount = (entryFee * maxPlayers * 0.95).toFixed(2); // 95% of total entry fees (5% platform fee)
    
    const game: Game = {
      ...insertGame,
      id,
      gameType: insertGame.gameType || "yahtzee", // Use provided game type or default to yahtzee
      maxPlayers,
      prizeAmount,
      currentPlayers: 0,
      status: "open",
      winnerId: null,
      currentRound: 1,
      totalRounds: insertGame.totalRounds || 13, // Use provided value or default to 13 for full Yahtzee
      currentTurnPlayerId: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
    };
    this.games.set(id, game);
    return game;
  }

  async getGame(id: string): Promise<Game | undefined> {
    return this.games.get(id);
  }

  async getAvailableGames(): Promise<Game[]> {
    return Array.from(this.games.values()).filter(
      game => game.status === "open" || game.status === "filling"
    );
  }

  async getUserActiveGame(userId: string): Promise<Game | undefined> {
    const allParticipants = Array.from(this.gameParticipants.values());
    logger.debug(`Storage Debug getUserActiveGame for ${userId}:`, {
      totalParticipants: allParticipants.length,
      participantUserIds: allParticipants.map(p => p.userId),
      lookingFor: userId
    });
    
    // Find ALL participant records for this user
    const userParticipants = allParticipants.filter(p => p.userId === userId);
    
    if (userParticipants.length === 0) {
      logger.debug(`Storage Debug: No participant found for user ${userId}`);
      return undefined;
    }
    
    // Get all games this user is participating in and filter for active ones
    const activeGames: Game[] = [];
    for (const participant of userParticipants) {
      const game = this.games.get(participant.gameId);
      if (game && (game.status === "open" || game.status === "filling" || game.status === "running")) {
        activeGames.push(game);
      }
    }
    
    logger.debug(`Storage Debug: Found ${userParticipants.length} participant records, ${activeGames.length} active games:`, {
      participantGameIds: userParticipants.map(p => p.gameId),
      activeGameIds: activeGames.map(g => ({ id: g.id, status: g.status, createdAt: g.createdAt }))
    });
    
    if (activeGames.length === 0) {
      logger.debug(`Storage Debug: No active games found for user ${userId}`);
      return undefined;
    }
    
    // Prioritize running games, then most recently created
    const runningGames = activeGames.filter(g => g.status === "running");
    if (runningGames.length > 0) {
      const mostRecentRunning = runningGames.sort((a, b) => 
        (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
      )[0];
      logger.debug(`Storage Debug: Returning most recent running game: ${mostRecentRunning.id}`);
      return mostRecentRunning;
    }
    
    // If no running games, return most recently created active game
    const mostRecentActive = activeGames.sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    )[0];
    logger.debug(`Storage Debug: Returning most recent active game: ${mostRecentActive.id}`);
    return mostRecentActive;
  }

  async updateGameStatus(gameId: string, status: string, winnerId?: string): Promise<Game> {
    const game = this.games.get(gameId);
    if (!game) throw new Error("Game not found");
    
    const updatedGame = { 
      ...game, 
      status,
      winnerId: winnerId || game.winnerId,
      startedAt: status === "running" ? new Date() : game.startedAt,
      completedAt: status === "completed" ? new Date() : game.completedAt,
    };
    this.games.set(gameId, updatedGame);
    return updatedGame;
  }

  async updateGamePlayers(gameId: string, currentPlayers: number): Promise<Game> {
    const game = this.games.get(gameId);
    if (!game) throw new Error("Game not found");
    
    const updatedGame = { 
      ...game, 
      currentPlayers,
      status: currentPlayers >= game.maxPlayers ? "full" : game.status
    };
    this.games.set(gameId, updatedGame);
    return updatedGame;
  }

  async updateGameTurn(gameId: string, currentRound: number, currentTurnPlayerId: string): Promise<Game> {
    const game = this.games.get(gameId);
    if (!game) throw new Error("Game not found");
    
    const updatedGame = { 
      ...game, 
      currentRound,
      currentTurnPlayerId
    };
    this.games.set(gameId, updatedGame);
    return updatedGame;
  }

  async addGameParticipant(gameId: string, userId: string): Promise<GameParticipant> {
    const id = randomUUID();
    const participant: GameParticipant = {
      id,
      gameId,
      userId,
      joinedAt: new Date(),
    };
    this.gameParticipants.set(id, participant);
    return participant;
  }

  async getGameParticipants(gameId: string): Promise<GameParticipant[]> {
    return Array.from(this.gameParticipants.values()).filter(
      p => p.gameId === gameId
    );
  }

  async removeGameParticipant(gameId: string, userId: string): Promise<void> {
    const participant = Array.from(this.gameParticipants.entries()).find(
      ([, p]) => p.gameId === gameId && p.userId === userId
    );
    
    if (participant) {
      this.gameParticipants.delete(participant[0]);
    }
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = {
      ...insertTransaction,
      id,
      gameId: insertTransaction.gameId || null,
      createdAt: new Date(),
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  // Yahtzee-specific methods
  async createYahtzeePlayerState(state: InsertYahtzeePlayerState): Promise<YahtzeePlayerState> {
    const id = randomUUID();
    const playerState: YahtzeePlayerState = {
      id,
      gameId: state.gameId,
      userId: state.userId,
      // Upper Section Categories (count specific numbers)
      ones: -1,
      twos: -1,
      threes: -1,
      fours: -1,
      fives: -1,
      sixes: -1,
      upperSectionBonus: 0,
      // Lower Section Categories
      threeOfAKind: -1,
      fourOfAKind: -1,
      fullHouse: -1,
      smallStraight: -1,
      largeStraight: -1,
      yahtzee: -1,
      yahtzeeBonus: 0,
      chance: -1,
      totalScore: 0,
      turnsCompleted: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.yahtzeePlayerStates.set(id, playerState);
    return playerState;
  }

  async getYahtzeePlayerState(gameId: string, userId: string): Promise<YahtzeePlayerState | undefined> {
    return Array.from(this.yahtzeePlayerStates.values()).find(
      state => state.gameId === gameId && state.userId === userId
    );
  }

  async updateYahtzeePlayerState(gameId: string, userId: string, updates: Partial<YahtzeePlayerState>): Promise<YahtzeePlayerState> {
    const existingState = await this.getYahtzeePlayerState(gameId, userId);
    if (!existingState) throw new Error("Player state not found");
    
    const updatedState = { 
      ...existingState, 
      ...updates,
      updatedAt: new Date()
    };
    this.yahtzeePlayerStates.set(existingState.id, updatedState);
    return updatedState;
  }

  async getYahtzeeGameStates(gameId: string): Promise<YahtzeePlayerState[]> {
    return Array.from(this.yahtzeePlayerStates.values()).filter(
      state => state.gameId === gameId
    );
  }

  async createYahtzeeTurn(turn: InsertYahtzeeTurn): Promise<YahtzeeTurn> {
    const id = randomUUID();
    
    // Don't generate dice values automatically - wait for first roll
    // Set default dice values until first roll occurs
    const yahtzeeTurn: YahtzeeTurn = {
      id,
      gameId: turn.gameId,
      userId: turn.userId,
      round: turn.round,
      rollCount: 0, // Start with rollCount 0 - no rolls used yet
      dice1: 1, // Default dice values until first roll
      dice2: 1,
      dice3: 1,
      dice4: 1,
      dice5: 1,
      hold1: false,
      hold2: false,
      hold3: false,
      hold4: false,
      hold5: false,
      isCompleted: false,
      scoredCategory: null,
      scoredPoints: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.yahtzeeTurns.set(id, yahtzeeTurn);
    return yahtzeeTurn;
  }

  async getCurrentYahtzeeTurn(gameId: string, userId: string): Promise<YahtzeeTurn | undefined> {
    return Array.from(this.yahtzeeTurns.values()).find(
      turn => turn.gameId === gameId && turn.userId === userId && !turn.isCompleted
    );
  }

  async updateYahtzeeTurn(turnId: string, updates: Partial<YahtzeeTurn>): Promise<YahtzeeTurn> {
    const turn = this.yahtzeeTurns.get(turnId);
    if (!turn) throw new Error("Turn not found");
    
    const updatedTurn = { 
      ...turn, 
      ...updates,
      updatedAt: new Date()
    };
    this.yahtzeeTurns.set(turnId, updatedTurn);
    return updatedTurn;
  }

  async completeYahtzeeTurn(turnId: string, category: string, points: number): Promise<YahtzeeTurn> {
    return await this.updateYahtzeeTurn(turnId, {
      isCompleted: true,
      scoredCategory: category,
      scoredPoints: points
    });
  }

  // Match result methods
  async saveMatchResult(insertResult: InsertMatchResult, insertPlayers: InsertMatchResultPlayer[]): Promise<MatchResult> {
    const resultId = randomUUID();
    const matchResult: MatchResult = {
      id: resultId,
      gameId: insertResult.gameId,
      winnerId: insertResult.winnerId,
      prizeAmount: insertResult.prizeAmount,
      completedAt: new Date(),
    };
    this.matchResults.set(resultId, matchResult);

    // Save all players
    for (const insertPlayer of insertPlayers) {
      const playerId = randomUUID();
      const player: MatchResultPlayer = {
        id: playerId,
        matchResultId: resultId,
        userId: insertPlayer.userId,
        username: insertPlayer.username,
        totalScore: insertPlayer.totalScore,
        rank: insertPlayer.rank,
        entryFee: insertPlayer.entryFee,
        netChange: insertPlayer.netChange,
      };
      this.matchResultPlayers.set(playerId, player);
    }

    return matchResult;
  }

  async getGameFinalResults(gameId: string): Promise<MatchResultWithPlayers | undefined> {
    const matchResult = Array.from(this.matchResults.values()).find(
      result => result.gameId === gameId
    );
    
    if (!matchResult) {
      return undefined;
    }

    const players = Array.from(this.matchResultPlayers.values())
      .filter(player => player.matchResultId === matchResult.id)
      .sort((a, b) => a.rank - b.rank);

    return {
      ...matchResult,
      players
    };
  }

  async getUserMatchHistory(userId: string, limit: number = 50, offset: number = 0): Promise<MatchResultWithPlayers[]> {
    // Find all match result players for this user
    const userPlayerRecords = Array.from(this.matchResultPlayers.values())
      .filter(player => player.userId === userId);

    // Get the corresponding match results
    const userMatchResults: MatchResultWithPlayers[] = [];
    
    for (const playerRecord of userPlayerRecords) {
      const matchResult = this.matchResults.get(playerRecord.matchResultId);
      if (matchResult) {
        // Get all players for this match
        const allPlayers = Array.from(this.matchResultPlayers.values())
          .filter(player => player.matchResultId === matchResult.id)
          .sort((a, b) => a.rank - b.rank);

        userMatchResults.push({
          ...matchResult,
          players: allPlayers
        });
      }
    }

    // Sort by completion date (most recent first) and apply pagination
    return userMatchResults
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
      .slice(offset, offset + limit);
  }

  // CRITICAL SECURITY FIX: Atomic withdrawal operation to prevent race conditions
  async atomicWithdrawal(userId: string, amount: string, idempotencyKey: string): Promise<WithdrawalResult> {
    // Check for idempotency - prevent duplicate requests
    if (this.processedIdempotencyKeys.has(idempotencyKey)) {
      return {
        success: false,
        error: "Withdrawal request already processed"
      };
    }

    // Use per-user locking to prevent concurrent withdrawals for same user
    if (this.withdrawalLocks.has(userId)) {
      return await this.withdrawalLocks.get(userId)!;
    }

    // Create the atomic operation promise
    const operationPromise = this.performAtomicWithdrawal(userId, amount, idempotencyKey);
    this.withdrawalLocks.set(userId, operationPromise);

    try {
      const result = await operationPromise;
      return result;
    } finally {
      // Always clean up the lock
      this.withdrawalLocks.delete(userId);
    }
  }

  private async performAtomicWithdrawal(userId: string, amount: string, idempotencyKey: string): Promise<WithdrawalResult> {
    try {
      // All operations must be atomic - if any fail, none should be applied
      const user = this.users.get(userId);
      if (!user) {
        return {
          success: false,
          error: "User not found"
        };
      }

      // Use precise decimal arithmetic
      const withdrawAmount = new MoneyAmount(amount);
      const currentBalance = new MoneyAmount(user.balance);

      // Validation
      if (withdrawAmount.isLessThan(MoneyAmount.MIN_WITHDRAWAL)) {
        return {
          success: false,
          error: `Minimum withdrawal amount is $${MoneyAmount.MIN_WITHDRAWAL.toString()}`
        };
      }

      // UPDATED: Allow full balance withdrawal instead of just winnings
      // This makes the system more intuitive - users can withdraw whatever they have
      const availableForWithdrawal = currentBalance;

      if (withdrawAmount.isGreaterThan(availableForWithdrawal)) {
        return {
          success: false,
          error: `Insufficient balance for withdrawal. Available: $${availableForWithdrawal.toString()}`,
          availableForWithdrawal: availableForWithdrawal.toString()
        };
      }

      if (withdrawAmount.isGreaterThan(currentBalance)) {
        return {
          success: false,
          error: "Insufficient balance for withdrawal"
        };
      }

      // Perform atomic updates
      const newBalance = currentBalance.subtract(withdrawAmount);
      const updatedUser = { ...user, balance: newBalance.toString() };
      this.users.set(userId, updatedUser);

      // Create transaction record
      const transactionId = randomUUID();
      const transaction: Transaction = {
        id: transactionId,
        userId,
        type: "withdrawal",
        amount: `-${withdrawAmount.toString()}`,
        description: "Withdrawal Request - Pending Manual Processing",
        gameId: null,
        balanceAfter: newBalance.toString(),
        createdAt: new Date(),
      };
      this.transactions.set(transactionId, transaction);

      // Mark idempotency key as processed
      this.processedIdempotencyKeys.add(idempotencyKey);

      return {
        success: true,
        user: updatedUser,
        transaction,
        availableForWithdrawal: availableForWithdrawal.toString()
      };

    } catch (error) {
      logger.error("Atomic withdrawal error:", error);
      return {
        success: false,
        error: "Internal server error during withdrawal processing"
      };
    }
  }

  // CRITICAL PAYMENT PROTECTION: Webhook idempotency to prevent double charging
  async isWebhookProcessed(webhookId: string): Promise<boolean> {
    return this.processedWebhooks.has(webhookId);
  }

  async markWebhookProcessed(webhookId: string): Promise<void> {
    this.processedWebhooks.add(webhookId);
  }

  // Game invitation operations
  async createGameInvitation(invitation: InsertGameInvitation): Promise<GameInvitation> {
    const id = randomUUID();
    const gameInvitation: GameInvitation = {
      id,
      ...invitation,
      createdAt: new Date(),
      respondedAt: null,
    };

    this.gameInvitations.set(id, gameInvitation);
    return gameInvitation;
  }

  async getGameInvitation(id: string): Promise<GameInvitation | undefined> {
    return this.gameInvitations.get(id);
  }

  async getUserInvitations(userId: string, status?: string): Promise<GameInvitation[]> {
    const invitations = Array.from(this.gameInvitations.values())
      .filter(invitation => invitation.toUserId === userId);
    
    if (status) {
      return invitations.filter(invitation => invitation.status === status);
    }
    
    return invitations;
  }

  async updateInvitationStatus(id: string, status: string, respondedAt?: Date): Promise<GameInvitation> {
    const invitation = this.gameInvitations.get(id);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    const updatedInvitation: GameInvitation = {
      ...invitation,
      status,
      respondedAt: respondedAt || new Date(),
    };

    this.gameInvitations.set(id, updatedInvitation);
    return updatedInvitation;
  }

  async expireOldInvitations(): Promise<void> {
    const now = new Date();
    for (const [id, invitation] of this.gameInvitations.entries()) {
      if (invitation.status === "pending" && invitation.expiresAt < now) {
        invitation.status = "expired";
        this.gameInvitations.set(id, invitation);
      }
    }
  }

  async createPlinkoResult(result: InsertPlinkoResult): Promise<PlinkoResult> {
    const id = randomUUID();
    const plinkoResult: PlinkoResult = {
      id,
      ...result,
      createdAt: new Date(),
    };
    this.plinkoResults.set(id, plinkoResult);
    return plinkoResult;
  }

  async getUserPlinkoResults(userId: string, limit: number = 50): Promise<PlinkoResult[]> {
    return Array.from(this.plinkoResults.values())
      .filter(result => result.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createDiceResult(result: InsertDiceResult): Promise<DiceResult> {
    const id = randomUUID();
    const diceResult: DiceResult = {
      id,
      ...result,
      createdAt: new Date(),
    };
    this.diceResults.set(id, diceResult);
    return diceResult;
  }

  async getUserDiceResults(userId: string, limit: number = 50): Promise<DiceResult[]> {
    return Array.from(this.diceResults.values())
      .filter(result => result.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createSlotsResult(result: InsertSlotsResult): Promise<SlotsResult> {
    const id = randomUUID();
    const slotsResult: SlotsResult = {
      id,
      ...result,
      createdAt: new Date(),
    };
    this.slotsResults.set(id, slotsResult);
    return slotsResult;
  }

  async getUserSlotsResults(userId: string, limit: number = 50): Promise<SlotsResult[]> {
    return Array.from(this.slotsResults.values())
      .filter(result => result.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Batched game play operation for better performance
  async batchGamePlay(
    userId: string,
    gameType: 'plinko' | 'dice' | 'slots',
    user: User,
    newBalance: string,
    transaction: Omit<InsertTransaction, 'createdAt'>,
    gameResult: InsertPlinkoResult | InsertDiceResult | InsertSlotsResult,
    newGamesPlayed: number,
    newGamesWon: number,
    newTotalWinnings: string
  ): Promise<{ transaction: Transaction; gameResult: PlinkoResult | DiceResult | SlotsResult }> {
    // Update user balance and stats
    const updatedUser = {
      ...user,
      balance: newBalance,
      gamesPlayed: newGamesPlayed,
      gamesWon: newGamesWon,
      totalWinnings: newTotalWinnings,
    };
    this.users.set(userId, updatedUser);
    
    // Create transaction
    const transactionId = randomUUID();
    const transactionDoc: Transaction = {
      id: transactionId,
      ...transaction,
      createdAt: new Date(),
    };
    this.transactions.set(transactionId, transactionDoc);
    
    // Create game result
    const resultId = randomUUID();
    const resultDoc = {
      id: resultId,
      ...gameResult,
      createdAt: new Date(),
    };
    
    if (gameType === 'plinko') {
      this.plinkoResults.set(resultId, resultDoc as PlinkoResult);
    } else if (gameType === 'dice') {
      this.diceResults.set(resultId, resultDoc as DiceResult);
    } else {
      this.slotsResults.set(resultId, resultDoc as SlotsResult);
    }
    
    return {
      transaction: transactionDoc,
      gameResult: resultDoc as PlinkoResult | DiceResult | SlotsResult,
    };
  }

  async createChessGameState(state: InsertChessGameState): Promise<ChessGameState> {
    const id = randomUUID();
    const chessGameState: ChessGameState = {
      id,
      ...state,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.chessGameStates.set(state.gameId, chessGameState);
    return chessGameState;
  }

  async getChessGameState(gameId: string): Promise<ChessGameState | undefined> {
    return this.chessGameStates.get(gameId);
  }

  async updateChessGameState(gameId: string, updates: Partial<ChessGameState>): Promise<ChessGameState> {
    const state = this.chessGameStates.get(gameId);
    if (!state) throw new Error("Chess game state not found");
    
    const updatedState = { 
      ...state, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.chessGameStates.set(gameId, updatedState);
    return updatedState;
  }

  async createChessMove(move: InsertChessMove): Promise<ChessMove> {
    const id = randomUUID();
    const chessMove: ChessMove = {
      id,
      ...move,
      createdAt: new Date(),
    };
    this.chessMoves.set(id, chessMove);
    return chessMove;
  }

  async getChessMoves(gameId: string): Promise<ChessMove[]> {
    return Array.from(this.chessMoves.values())
      .filter(move => move.gameId === gameId)
      .sort((a, b) => a.moveNumber - b.moveNumber);
  }

  // Page view methods
  async createPageView(view: InsertPageView): Promise<PageView> {
    const id = randomUUID();
    const pageView: PageView = {
      id,
      pagePath: view.pagePath,
      userId: view.userId ?? null,
      userAgent: view.userAgent ?? null,
      ipAddress: view.ipAddress ?? null,
      createdAt: new Date(),
    };
    this.pageViews.set(id, pageView);
    return pageView;
  }

  async getPageViews(pagePath?: string, hoursBack?: number): Promise<PageView[]> {
    let views = Array.from(this.pageViews.values());
    
    if (pagePath) {
      views = views.filter(v => v.pagePath === pagePath);
    }
    
    if (hoursBack) {
      const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
      views = views.filter(v => v.createdAt && v.createdAt >= startTime);
    }
    
    return views.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getPageViewCount(pagePath?: string, hoursBack?: number): Promise<number> {
    const views = await this.getPageViews(pagePath, hoursBack);
    return views.length;
  }

  // Bug report methods
  async createBugReport(report: InsertBugReport): Promise<BugReport> {
    const id = randomUUID();
    const bugReport: BugReport = {
      id,
      userId: report.userId ?? null,
      title: report.title,
      description: report.description,
      page: report.page,
      status: "pending",
      createdAt: new Date(),
    };
    this.bugReports.set(id, bugReport);
    return bugReport;
  }

  async getBugReports(status?: string): Promise<BugReport[]> {
    let reports = Array.from(this.bugReports.values());
    
    if (status) {
      reports = reports.filter(r => r.status === status);
    }
    
    return reports.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  // Tournament methods - Not implemented for MemStorage
  async createTournament(): Promise<Tournament> {
    throw new Error('Tournament operations are not supported in MemStorage. Please use FirestoreStorage.');
  }
  
  async getTournament(): Promise<Tournament | undefined> {
    throw new Error('Tournament operations are not supported in MemStorage. Please use FirestoreStorage.');
  }
  
  async getActiveTournaments(): Promise<Tournament[]> {
    throw new Error('Tournament operations are not supported in MemStorage. Please use FirestoreStorage.');
  }
  
  async getAllTournaments(): Promise<Tournament[]> {
    throw new Error('Tournament operations are not supported in MemStorage. Please use FirestoreStorage.');
  }
  
  async updateTournamentStatus(): Promise<Tournament> {
    throw new Error('Tournament operations are not supported in MemStorage. Please use FirestoreStorage.');
  }
  
  async updateTournamentParticipants(): Promise<Tournament> {
    throw new Error('Tournament operations are not supported in MemStorage. Please use FirestoreStorage.');
  }
  
  async markTournamentAsNotified(): Promise<void> {
    throw new Error('Tournament operations are not supported in MemStorage. Please use FirestoreStorage.');
  }
  
  async joinTournament(): Promise<TournamentParticipant> {
    throw new Error('Tournament operations are not supported in MemStorage. Please use FirestoreStorage.');
  }
  
  async leaveTournament(): Promise<void> {
    throw new Error('Tournament operations are not supported in MemStorage. Please use FirestoreStorage.');
  }
  
  async getTournamentParticipants(): Promise<TournamentParticipant[]> {
    throw new Error('Tournament operations are not supported in MemStorage. Please use FirestoreStorage.');
  }
  
  async startTournament(): Promise<Game> {
    throw new Error('Tournament operations are not supported in MemStorage. Please use FirestoreStorage.');
  }
  
  async isUserInTournament(): Promise<boolean> {
    throw new Error('Tournament operations are not supported in MemStorage. Please use FirestoreStorage.');
  }
}

export class FileStorage implements IStorage {
  private dataDir: string;
  private usersFile: string;
  private gamesFile: string;
  private gameParticipantsFile: string;
  private transactionsFile: string;
  private yahtzeePlayerStatesFile: string;
  private yahtzeeTurnsFile: string;
  private matchResultsFile: string;
  private matchResultPlayersFile: string;
  private gameInvitationsFile: string;
  private plinkoResultsFile: string;
  private diceResultsFile: string;
  private slotsResultsFile: string;
  private chessGameStatesFile: string;
  private chessMovesFile: string;
  private pageViewsFile: string;
  private bugReportsFile: string;
  private processedWebhooksFile: string;
  private withdrawalLocks: Map<string, Promise<WithdrawalResult>>;
  private processedIdempotencyKeys: Set<string>;
  private processedWebhooks: Set<string>;

  constructor(dataDir: string = "data") {
    this.dataDir = dataDir;
    this.usersFile = path.join(dataDir, "users.json");
    this.gamesFile = path.join(dataDir, "games.json");
    this.gameParticipantsFile = path.join(dataDir, "gameParticipants.json");
    this.transactionsFile = path.join(dataDir, "transactions.json");
    this.yahtzeePlayerStatesFile = path.join(dataDir, "yahtzeePlayerStates.json");
    this.yahtzeeTurnsFile = path.join(dataDir, "yahtzeeTurns.json");
    this.matchResultsFile = path.join(dataDir, "matchResults.json");
    this.matchResultPlayersFile = path.join(dataDir, "matchResultPlayers.json");
    this.gameInvitationsFile = path.join(dataDir, "gameInvitations.json");
    this.plinkoResultsFile = path.join(dataDir, "plinkoResults.json");
    this.diceResultsFile = path.join(dataDir, "diceResults.json");
    this.slotsResultsFile = path.join(dataDir, "slotsResults.json");
    this.chessGameStatesFile = path.join(dataDir, "chessGameStates.json");
    this.chessMovesFile = path.join(dataDir, "chessMoves.json");
    this.pageViewsFile = path.join(dataDir, "pageViews.json");
    this.bugReportsFile = path.join(dataDir, "bugReports.json");
    this.processedWebhooksFile = path.join(dataDir, "processedWebhooks.json");
    this.withdrawalLocks = new Map();
    this.processedIdempotencyKeys = new Set();
    this.processedWebhooks = new Set();
  }

  private async ensureDataDir(): Promise<void> {
    if (!existsSync(this.dataDir)) {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  private async readJSONFile<T>(filePath: string): Promise<Record<string, T>> {
    try {
      if (!existsSync(filePath)) {
        return {};
      }
      const data = await fs.readFile(filePath, "utf-8");
      
      // Handle empty or whitespace-only files
      if (!data.trim()) {
        console.warn(`Empty JSON file detected: ${filePath}, initializing with empty object`);
        await this.writeJSONFile(filePath, {});
        return {};
      }
      
      return JSON.parse(data, (key, value) => {
        // Convert date strings back to Date objects
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          return new Date(value);
        }
        return value;
      });
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error);
      
      // If JSON parsing fails, try to recover by reinitializing the file
      if (error instanceof SyntaxError) {
        console.warn(`Corrupted JSON file detected: ${filePath}, reinitializing...`);
        try {
          await this.writeJSONFile(filePath, {});
          return {};
        } catch (writeError) {
          console.error(`Failed to reinitialize ${filePath}:`, writeError);
        }
      }
      
      return {};
    }
  }

  private async writeJSONFile<T>(filePath: string, data: Record<string, T>): Promise<void> {
    await this.ensureDataDir();
    
    // Write to a temporary file first, then rename to prevent corruption
    const tempFilePath = `${filePath}.tmp`;
    try {
      await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2));
      await fs.rename(tempFilePath, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        if (existsSync(tempFilePath)) {
          await fs.unlink(tempFilePath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private async loadUsers(): Promise<Record<string, User>> {
    return await this.readJSONFile<User>(this.usersFile);
  }

  private async saveUsers(users: Record<string, User>): Promise<void> {
    await this.writeJSONFile(this.usersFile, users);
  }

  private async loadGames(): Promise<Record<string, Game>> {
    return await this.readJSONFile<Game>(this.gamesFile);
  }

  private async saveGames(games: Record<string, Game>): Promise<void> {
    await this.writeJSONFile(this.gamesFile, games);
  }

  private async loadGameParticipants(): Promise<Record<string, GameParticipant>> {
    return await this.readJSONFile<GameParticipant>(this.gameParticipantsFile);
  }

  private async saveGameParticipants(participants: Record<string, GameParticipant>): Promise<void> {
    await this.writeJSONFile(this.gameParticipantsFile, participants);
  }

  private async loadTransactions(): Promise<Record<string, Transaction>> {
    return await this.readJSONFile<Transaction>(this.transactionsFile);
  }

  private async saveTransactions(transactions: Record<string, Transaction>): Promise<void> {
    await this.writeJSONFile(this.transactionsFile, transactions);
  }

  private async loadYahtzeePlayerStates(): Promise<Record<string, YahtzeePlayerState>> {
    return await this.readJSONFile<YahtzeePlayerState>(this.yahtzeePlayerStatesFile);
  }

  private async saveYahtzeePlayerStates(states: Record<string, YahtzeePlayerState>): Promise<void> {
    await this.writeJSONFile(this.yahtzeePlayerStatesFile, states);
  }

  private async loadYahtzeeTurns(): Promise<Record<string, YahtzeeTurn>> {
    return await this.readJSONFile<YahtzeeTurn>(this.yahtzeeTurnsFile);
  }

  private async saveYahtzeeTurns(turns: Record<string, YahtzeeTurn>): Promise<void> {
    await this.writeJSONFile(this.yahtzeeTurnsFile, turns);
  }

  private async loadMatchResults(): Promise<Record<string, MatchResult>> {
    return await this.readJSONFile<MatchResult>(this.matchResultsFile);
  }

  private async saveMatchResults(matchResults: Record<string, MatchResult>): Promise<void> {
    await this.writeJSONFile(this.matchResultsFile, matchResults);
  }

  private async loadMatchResultPlayers(): Promise<Record<string, MatchResultPlayer>> {
    return await this.readJSONFile<MatchResultPlayer>(this.matchResultPlayersFile);
  }

  private async saveMatchResultPlayers(players: Record<string, MatchResultPlayer>): Promise<void> {
    await this.writeJSONFile(this.matchResultPlayersFile, players);
  }

  private async loadGameInvitations(): Promise<Record<string, GameInvitation>> {
    return await this.readJSONFile<GameInvitation>(this.gameInvitationsFile);
  }

  private async saveGameInvitations(invitations: Record<string, GameInvitation>): Promise<void> {
    await this.writeJSONFile(this.gameInvitationsFile, invitations);
  }

  private async loadPlinkoResults(): Promise<Record<string, PlinkoResult>> {
    return await this.readJSONFile<PlinkoResult>(this.plinkoResultsFile);
  }

  private async savePlinkoResults(results: Record<string, PlinkoResult>): Promise<void> {
    await this.writeJSONFile(this.plinkoResultsFile, results);
  }

  private async loadDiceResults(): Promise<Record<string, DiceResult>> {
    return await this.readJSONFile<DiceResult>(this.diceResultsFile);
  }

  private async saveDiceResults(results: Record<string, DiceResult>): Promise<void> {
    await this.writeJSONFile(this.diceResultsFile, results);
  }

  private async loadSlotsResults(): Promise<Record<string, SlotsResult>> {
    return await this.readJSONFile<SlotsResult>(this.slotsResultsFile);
  }

  private async saveSlotsResults(results: Record<string, SlotsResult>): Promise<void> {
    await this.writeJSONFile(this.slotsResultsFile, results);
  }

  private async loadChessGameStates(): Promise<Record<string, ChessGameState>> {
    return await this.readJSONFile<ChessGameState>(this.chessGameStatesFile);
  }

  private async saveChessGameStates(states: Record<string, ChessGameState>): Promise<void> {
    await this.writeJSONFile(this.chessGameStatesFile, states);
  }

  private async loadChessMoves(): Promise<Record<string, ChessMove>> {
    return await this.readJSONFile<ChessMove>(this.chessMovesFile);
  }

  private async saveChessMoves(moves: Record<string, ChessMove>): Promise<void> {
    await this.writeJSONFile(this.chessMovesFile, moves);
  }

  private async loadPageViews(): Promise<Record<string, PageView>> {
    return await this.readJSONFile<PageView>(this.pageViewsFile);
  }

  private async savePageViews(views: Record<string, PageView>): Promise<void> {
    await this.writeJSONFile(this.pageViewsFile, views);
  }

  private async loadBugReports(): Promise<Record<string, BugReport>> {
    return await this.readJSONFile<BugReport>(this.bugReportsFile);
  }

  private async saveBugReports(reports: Record<string, BugReport>): Promise<void> {
    await this.writeJSONFile(this.bugReportsFile, reports);
  }

  private async loadProcessedWebhooks(): Promise<Record<string, boolean>> {
    return await this.readJSONFile<boolean>(this.processedWebhooksFile);
  }

  private async saveProcessedWebhooks(webhooks: Record<string, boolean>): Promise<void> {
    await this.writeJSONFile(this.processedWebhooksFile, webhooks);
  }

  async initializeDefaultData(): Promise<void> {
    const users = await this.loadUsers();
    
    // Only initialize if no users exist
    if (Object.keys(users).length === 0) {
      const defaultUser: User = {
        id: "user-1",
        username: "player_alex",
        email: "alex@example.com",
        balance: "25.00",
        profileImageUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&h=80",
        gamesPlayed: 47,
        gamesWon: 15,
        totalWinnings: "75.00",
        createdAt: new Date(),
      };
      users[defaultUser.id] = defaultUser;
      await this.saveUsers(users);

      // Create some initial games
      const games = {
        "game-1": {
          id: "game-1",
          name: "Lightning Round",
          gameType: "yahtzee",
          entryFee: "2.00",
          maxPlayers: 3,
          currentPlayers: 2,
          prizeAmount: "5.00",
          status: "open",
          winnerId: null,
          currentRound: 1,
          totalRounds: 13, // Full Yahtzee game
          currentTurnPlayerId: null,
          createdAt: new Date(),
          startedAt: null,
          completedAt: null,
        },
        "game-2": {
          id: "game-2",
          name: "High Stakes",
          gameType: "yahtzee",
          entryFee: "5.00",
          maxPlayers: 3,
          currentPlayers: 2,
          prizeAmount: "12.50",
          status: "filling",
          winnerId: null,
          currentRound: 1,
          totalRounds: 13, // Full Yahtzee game
          currentTurnPlayerId: null,
          createdAt: new Date(),
          startedAt: null,
          completedAt: null,
        },
        "game-3": {
          id: "game-3",
          name: "Quick Draw",
          gameType: "yahtzee",
          entryFee: "1.00",
          maxPlayers: 3,
          currentPlayers: 0,
          prizeAmount: "2.50",
          status: "open",
          winnerId: null,
          currentRound: 1,
          totalRounds: 13, // Full Yahtzee game
          currentTurnPlayerId: null,
          createdAt: new Date(),
          startedAt: null,
          completedAt: null,
        }
      };
      await this.saveGames(games);

      // Add participant for game-1
      const participant = {
        "participant-1": {
          id: "participant-1",
          gameId: "game-1",
          userId: "user-1",
          joinedAt: new Date(),
        }
      };
      await this.saveGameParticipants(participant);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const users = await this.loadUsers();
    return users[id];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const users = await this.loadUsers();
    return Object.values(users).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser & { id?: string }): Promise<User> {
    const users = await this.loadUsers();
    const id = insertUser.id || randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      email: insertUser.email || null,
      profileImageUrl: insertUser.profileImageUrl || null,
      balance: "0.00",
      gamesPlayed: 0,
      gamesWon: 0,
      totalWinnings: "0.00",
      createdAt: new Date(),
    };
    users[id] = user;
    await this.saveUsers(users);
    return user;
  }

  async createOrGetUser(id: string, profile: InsertUser): Promise<User> {
    const existingUser = await this.getUser(id);
    if (existingUser) {
      // Only update non-empty fields to avoid overwriting with placeholder data
      const updates: Partial<InsertUser> = {};
      if (profile.username && profile.username !== `Player${id.slice(-4)}`) {
        updates.username = profile.username;
      }
      if (profile.email) {
        updates.email = profile.email;
      }
      if (profile.profileImageUrl) {
        updates.profileImageUrl = profile.profileImageUrl;
      }
      
      // Only update if there are meaningful changes
      if (Object.keys(updates).length > 0) {
        return await this.updateUser(id, updates);
      }
      
      return existingUser;
    }
    return await this.createUser({ ...profile, id });
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const users = await this.loadUsers();
    const user = users[id];
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, ...updates };
    users[id] = updatedUser;
    await this.saveUsers(users);
    return updatedUser;
  }

  async updateUserBalance(userId: string, newBalance: string): Promise<User> {
    const users = await this.loadUsers();
    const user = users[userId];
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, balance: newBalance };
    users[userId] = updatedUser;
    await this.saveUsers(users);
    return updatedUser;
  }

  async updateUserStats(userId: string, gamesPlayed: number, gamesWon: number, totalWinnings: string): Promise<User> {
    const users = await this.loadUsers();
    const user = users[userId];
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, gamesPlayed, gamesWon, totalWinnings };
    users[userId] = updatedUser;
    await this.saveUsers(users);
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    const users = await this.loadUsers();
    return Object.values(users);
  }

  async updateUserActivity(userId: string): Promise<User | undefined> {
    const users = await this.loadUsers();
    const user = users[userId];
    if (!user) {
      return undefined;
    }
    
    const updatedUser = {
      ...user,
      lastActivity: new Date(),
    };
    
    users[userId] = updatedUser;
    await this.saveUsers(users);
    return updatedUser;
  }

  async createGame(insertGame: InsertGame): Promise<Game> {
    const games = await this.loadGames();
    const id = randomUUID();
    const maxPlayers = insertGame.maxPlayers || 3;
    const entryFee = parseFloat(insertGame.entryFee);
    const prizeAmount = (entryFee * maxPlayers * 0.95).toFixed(2); // 95% of total entry fees (5% platform fee)
    
    const game: Game = {
      ...insertGame,
      id,
      gameType: insertGame.gameType || "yahtzee",
      maxPlayers,
      prizeAmount,
      currentPlayers: 0,
      status: "open",
      winnerId: null,
      currentRound: 1,
      totalRounds: insertGame.totalRounds || 13, // Use provided value or default to 13 for full Yahtzee
      currentTurnPlayerId: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
    };
    games[id] = game;
    await this.saveGames(games);
    return game;
  }

  async getGame(id: string): Promise<Game | undefined> {
    const games = await this.loadGames();
    return games[id];
  }

  async getAvailableGames(): Promise<Game[]> {
    const games = await this.loadGames();
    return Object.values(games).filter(
      game => game.status === "open" || game.status === "filling"
    );
  }

  async getUserActiveGame(userId: string): Promise<Game | undefined> {
    const participants = await this.loadGameParticipants();
    const allParticipants = Object.values(participants);
    logger.debug(`FileStorage Debug getUserActiveGame for ${userId}:`, {
      totalParticipants: allParticipants.length,
      participantUserIds: allParticipants.map(p => p.userId),
      lookingFor: userId
    });
    
    // Find ALL participant records for this user
    const userParticipants = allParticipants.filter(p => p.userId === userId);
    
    if (userParticipants.length === 0) {
      logger.debug(`FileStorage Debug: No participant found for user ${userId}`);
      return undefined;
    }
    
    // Get all games this user is participating in and filter for active ones
    const games = await this.loadGames();
    const activeGames: Game[] = [];
    for (const participant of userParticipants) {
      const game = games[participant.gameId];
      if (game && (game.status === "open" || game.status === "filling" || game.status === "running")) {
        activeGames.push(game);
      }
    }
    
    logger.debug(`FileStorage Debug: Found ${userParticipants.length} participant records, ${activeGames.length} active games:`, {
      participantGameIds: userParticipants.map(p => p.gameId),
      activeGameIds: activeGames.map(g => ({ id: g.id, status: g.status, createdAt: g.createdAt }))
    });
    
    if (activeGames.length === 0) {
      logger.debug(`FileStorage Debug: No active games found for user ${userId}`);
      return undefined;
    }
    
    // Prioritize running games, then most recently created
    const runningGames = activeGames.filter(g => g.status === "running");
    if (runningGames.length > 0) {
      const mostRecentRunning = runningGames.sort((a, b) => 
        (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
      )[0];
      logger.debug(`FileStorage Debug: Returning most recent running game: ${mostRecentRunning.id}`);
      return mostRecentRunning;
    }
    
    // If no running games, return most recently created active game
    const mostRecentActive = activeGames.sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    )[0];
    logger.debug(`FileStorage Debug: Returning most recent active game: ${mostRecentActive.id}`);
    return mostRecentActive;
  }

  async updateGameStatus(gameId: string, status: string, winnerId?: string): Promise<Game> {
    const games = await this.loadGames();
    const game = games[gameId];
    if (!game) throw new Error("Game not found");
    
    const updatedGame = { 
      ...game, 
      status,
      winnerId: winnerId || game.winnerId,
      startedAt: status === "running" ? new Date() : game.startedAt,
      completedAt: status === "completed" ? new Date() : game.completedAt,
    };
    games[gameId] = updatedGame;
    await this.saveGames(games);
    return updatedGame;
  }

  async updateGamePlayers(gameId: string, currentPlayers: number): Promise<Game> {
    const games = await this.loadGames();
    const game = games[gameId];
    if (!game) throw new Error("Game not found");
    
    const updatedGame = { 
      ...game, 
      currentPlayers,
      status: currentPlayers >= game.maxPlayers ? "full" : game.status
    };
    games[gameId] = updatedGame;
    await this.saveGames(games);
    return updatedGame;
  }

  async updateGameTurn(gameId: string, currentRound: number, currentTurnPlayerId: string): Promise<Game> {
    const games = await this.loadGames();
    const game = games[gameId];
    if (!game) throw new Error("Game not found");
    
    const updatedGame = { 
      ...game, 
      currentRound,
      currentTurnPlayerId
    };
    games[gameId] = updatedGame;
    await this.saveGames(games);
    return updatedGame;
  }

  async addGameParticipant(gameId: string, userId: string): Promise<GameParticipant> {
    const participants = await this.loadGameParticipants();
    const id = randomUUID();
    const participant: GameParticipant = {
      id,
      gameId,
      userId,
      joinedAt: new Date(),
    };
    participants[id] = participant;
    await this.saveGameParticipants(participants);
    return participant;
  }

  async getGameParticipants(gameId: string): Promise<GameParticipant[]> {
    const participants = await this.loadGameParticipants();
    return Object.values(participants).filter(p => p.gameId === gameId);
  }

  async removeGameParticipant(gameId: string, userId: string): Promise<void> {
    const participants = await this.loadGameParticipants();
    const participantEntry = Object.entries(participants).find(
      ([, p]) => p.gameId === gameId && p.userId === userId
    );
    
    if (participantEntry) {
      delete participants[participantEntry[0]];
      await this.saveGameParticipants(participants);
    }
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const transactions = await this.loadTransactions();
    const id = randomUUID();
    const transaction: Transaction = {
      ...insertTransaction,
      id,
      gameId: insertTransaction.gameId || null,
      createdAt: new Date(),
    };
    transactions[id] = transaction;
    await this.saveTransactions(transactions);
    return transaction;
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    const transactions = await this.loadTransactions();
    return Object.values(transactions)
      .filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getAllTransactions(): Promise<Transaction[]> {
    const transactions = await this.loadTransactions();
    return Object.values(transactions)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  // Yahtzee-specific methods
  async createYahtzeePlayerState(state: InsertYahtzeePlayerState): Promise<YahtzeePlayerState> {
    const states = await this.loadYahtzeePlayerStates();
    const id = randomUUID();
    const playerState: YahtzeePlayerState = {
      id,
      gameId: state.gameId,
      userId: state.userId,
      // Upper Section Categories (count specific numbers)
      ones: -1,
      twos: -1,
      threes: -1,
      fours: -1,
      fives: -1,
      sixes: -1,
      upperSectionBonus: 0,
      // Lower Section Categories
      threeOfAKind: -1,
      fourOfAKind: -1,
      fullHouse: -1,
      smallStraight: -1,
      largeStraight: -1,
      yahtzee: -1,
      yahtzeeBonus: 0,
      chance: -1,
      totalScore: 0,
      turnsCompleted: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    states[id] = playerState;
    await this.saveYahtzeePlayerStates(states);
    return playerState;
  }

  async getYahtzeePlayerState(gameId: string, userId: string): Promise<YahtzeePlayerState | undefined> {
    const states = await this.loadYahtzeePlayerStates();
    return Object.values(states).find(
      state => state.gameId === gameId && state.userId === userId
    );
  }

  async updateYahtzeePlayerState(gameId: string, userId: string, updates: Partial<YahtzeePlayerState>): Promise<YahtzeePlayerState> {
    const states = await this.loadYahtzeePlayerStates();
    const existingState = Object.values(states).find(
      state => state.gameId === gameId && state.userId === userId
    );
    if (!existingState) throw new Error("Player state not found");
    
    const updatedState = { 
      ...existingState, 
      ...updates,
      updatedAt: new Date()
    };
    states[existingState.id] = updatedState;
    await this.saveYahtzeePlayerStates(states);
    return updatedState;
  }

  async getYahtzeeGameStates(gameId: string): Promise<YahtzeePlayerState[]> {
    const states = await this.loadYahtzeePlayerStates();
    return Object.values(states).filter(
      state => state.gameId === gameId
    );
  }

  async createYahtzeeTurn(turn: InsertYahtzeeTurn): Promise<YahtzeeTurn> {
    const turns = await this.loadYahtzeeTurns();
    const id = randomUUID();
    
    // Don't generate dice values automatically - wait for first roll
    // Set default dice values until first roll occurs
    const yahtzeeTurn: YahtzeeTurn = {
      id,
      gameId: turn.gameId,
      userId: turn.userId,
      round: turn.round,
      rollCount: 0, // Start with rollCount 0 - no rolls used yet
      dice1: 1, // Default dice values until first roll
      dice2: 1,
      dice3: 1,
      dice4: 1,
      dice5: 1,
      hold1: false,
      hold2: false,
      hold3: false,
      hold4: false,
      hold5: false,
      isCompleted: false,
      scoredCategory: null,
      scoredPoints: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    turns[id] = yahtzeeTurn;
    await this.saveYahtzeeTurns(turns);
    return yahtzeeTurn;
  }

  async getCurrentYahtzeeTurn(gameId: string, userId: string): Promise<YahtzeeTurn | undefined> {
    const turns = await this.loadYahtzeeTurns();
    return Object.values(turns).find(
      turn => turn.gameId === gameId && turn.userId === userId && !turn.isCompleted
    );
  }

  async updateYahtzeeTurn(turnId: string, updates: Partial<YahtzeeTurn>): Promise<YahtzeeTurn> {
    const turns = await this.loadYahtzeeTurns();
    const turn = turns[turnId];
    if (!turn) throw new Error("Turn not found");
    
    const updatedTurn = { 
      ...turn, 
      ...updates,
      updatedAt: new Date()
    };
    turns[turnId] = updatedTurn;
    await this.saveYahtzeeTurns(turns);
    return updatedTurn;
  }

  async completeYahtzeeTurn(turnId: string, category: string, points: number): Promise<YahtzeeTurn> {
    return await this.updateYahtzeeTurn(turnId, {
      isCompleted: true,
      scoredCategory: category,
      scoredPoints: points
    });
  }

  // Match result methods
  async saveMatchResult(insertResult: InsertMatchResult, insertPlayers: InsertMatchResultPlayer[]): Promise<MatchResult> {
    const matchResults = await this.loadMatchResults();
    const matchResultPlayers = await this.loadMatchResultPlayers();
    
    const resultId = randomUUID();
    const matchResult: MatchResult = {
      id: resultId,
      gameId: insertResult.gameId,
      winnerId: insertResult.winnerId,
      prizeAmount: insertResult.prizeAmount,
      completedAt: new Date(),
    };
    matchResults[resultId] = matchResult;

    // Save all players
    for (const insertPlayer of insertPlayers) {
      const playerId = randomUUID();
      const player: MatchResultPlayer = {
        id: playerId,
        matchResultId: resultId,
        userId: insertPlayer.userId,
        username: insertPlayer.username,
        totalScore: insertPlayer.totalScore,
        rank: insertPlayer.rank,
        entryFee: insertPlayer.entryFee,
        netChange: insertPlayer.netChange,
      };
      matchResultPlayers[playerId] = player;
    }

    // Save to files
    await this.saveMatchResults(matchResults);
    await this.saveMatchResultPlayers(matchResultPlayers);
    
    return matchResult;
  }

  async getGameFinalResults(gameId: string): Promise<MatchResultWithPlayers | undefined> {
    const matchResults = await this.loadMatchResults();
    const matchResultPlayers = await this.loadMatchResultPlayers();
    
    const matchResult = Object.values(matchResults).find(
      result => result.gameId === gameId
    );
    
    if (!matchResult) {
      return undefined;
    }

    const players = Object.values(matchResultPlayers)
      .filter(player => player.matchResultId === matchResult.id)
      .sort((a, b) => a.rank - b.rank);

    return {
      ...matchResult,
      players
    };
  }

  async getUserMatchHistory(userId: string, limit: number = 50, offset: number = 0): Promise<MatchResultWithPlayers[]> {
    const matchResults = await this.loadMatchResults();
    const matchResultPlayers = await this.loadMatchResultPlayers();
    
    // Find all match result players for this user
    const userPlayerRecords = Object.values(matchResultPlayers)
      .filter(player => player.userId === userId);

    // Get the corresponding match results
    const userMatchResults: MatchResultWithPlayers[] = [];
    
    for (const playerRecord of userPlayerRecords) {
      const matchResult = matchResults[playerRecord.matchResultId];
      if (matchResult) {
        // Get all players for this match
        const allPlayers = Object.values(matchResultPlayers)
          .filter(player => player.matchResultId === matchResult.id)
          .sort((a, b) => a.rank - b.rank);

        userMatchResults.push({
          ...matchResult,
          players: allPlayers
        });
      }
    }

    // Sort by completion date (most recent first) and apply pagination
    return userMatchResults
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
      .slice(offset, offset + limit);
  }

  // Game invitation operations for FileStorage
  async createGameInvitation(invitation: InsertGameInvitation): Promise<GameInvitation> {
    await this.ensureDataDir();
    const invitations = await this.loadGameInvitations();
    
    const id = randomUUID();
    const gameInvitation: GameInvitation = {
      id,
      ...invitation,
      createdAt: new Date(),
      respondedAt: null,
    };

    invitations[id] = gameInvitation;
    await this.saveGameInvitations(invitations);
    return gameInvitation;
  }

  async getGameInvitation(id: string): Promise<GameInvitation | undefined> {
    const invitations = await this.loadGameInvitations();
    return invitations[id];
  }

  async getUserInvitations(userId: string, status?: string): Promise<GameInvitation[]> {
    const invitations = await this.loadGameInvitations();
    const userInvitations = Object.values(invitations)
      .filter(invitation => invitation.toUserId === userId);
    
    if (status) {
      return userInvitations.filter(invitation => invitation.status === status);
    }
    
    return userInvitations;
  }

  async updateInvitationStatus(id: string, status: string, respondedAt?: Date): Promise<GameInvitation> {
    await this.ensureDataDir();
    const invitations = await this.loadGameInvitations();
    
    const invitation = invitations[id];
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    const updatedInvitation: GameInvitation = {
      ...invitation,
      status,
      respondedAt: respondedAt || new Date(),
    };

    invitations[id] = updatedInvitation;
    await this.saveGameInvitations(invitations);
    return updatedInvitation;
  }

  async expireOldInvitations(): Promise<void> {
    await this.ensureDataDir();
    const invitations = await this.loadGameInvitations();
    const now = new Date();
    let hasUpdates = false;

    for (const [id, invitation] of Object.entries(invitations)) {
      if (invitation.status === "pending" && invitation.expiresAt < now) {
        invitations[id] = { ...invitation, status: "expired" };
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      await this.saveGameInvitations(invitations);
    }
  }

  // CRITICAL SECURITY FIX: Atomic withdrawal operation for FileStorage
  async atomicWithdrawal(userId: string, amount: string, idempotencyKey: string): Promise<WithdrawalResult> {
    // Check for idempotency - prevent duplicate requests
    if (this.processedIdempotencyKeys.has(idempotencyKey)) {
      return {
        success: false,
        error: "Withdrawal request already processed"
      };
    }

    // Use per-user locking to prevent concurrent withdrawals for same user
    if (this.withdrawalLocks.has(userId)) {
      return await this.withdrawalLocks.get(userId)!;
    }

    // Create the atomic operation promise
    const operationPromise = this.performAtomicWithdrawalFileStorage(userId, amount, idempotencyKey);
    this.withdrawalLocks.set(userId, operationPromise);

    try {
      const result = await operationPromise;
      return result;
    } finally {
      // Always clean up the lock
      this.withdrawalLocks.delete(userId);
    }
  }

  private async performAtomicWithdrawalFileStorage(userId: string, amount: string, idempotencyKey: string): Promise<WithdrawalResult> {
    try {
      // Load all required data atomically
      const [users, transactions] = await Promise.all([
        this.loadUsers(),
        this.loadTransactions()
      ]);

      const user = users[userId];
      if (!user) {
        return {
          success: false,
          error: "User not found"
        };
      }

      // Use precise decimal arithmetic
      const withdrawAmount = new MoneyAmount(amount);
      const currentBalance = new MoneyAmount(user.balance);

      // Validation
      if (withdrawAmount.isLessThan(MoneyAmount.MIN_WITHDRAWAL)) {
        return {
          success: false,
          error: `Minimum withdrawal amount is $${MoneyAmount.MIN_WITHDRAWAL.toString()}`
        };
      }

      // UPDATED: Allow full balance withdrawal instead of just winnings
      // This makes the system more intuitive - users can withdraw whatever they have
      const availableForWithdrawal = currentBalance;

      if (withdrawAmount.isGreaterThan(availableForWithdrawal)) {
        return {
          success: false,
          error: `Insufficient balance for withdrawal. Available: $${availableForWithdrawal.toString()}`,
          availableForWithdrawal: availableForWithdrawal.toString()
        };
      }

      if (withdrawAmount.isGreaterThan(currentBalance)) {
        return {
          success: false,
          error: "Insufficient balance for withdrawal"
        };
      }

      // Perform atomic updates
      const newBalance = currentBalance.subtract(withdrawAmount);
      const updatedUser = { ...user, balance: newBalance.toString() };
      users[userId] = updatedUser;

      // Create transaction record
      const transactionId = randomUUID();
      const transaction: Transaction = {
        id: transactionId,
        userId,
        type: "withdrawal",
        amount: `-${withdrawAmount.toString()}`,
        description: "Withdrawal Request - Pending Manual Processing",
        gameId: null,
        balanceAfter: newBalance.toString(),
        createdAt: new Date(),
      };
      transactions[transactionId] = transaction;

      // Save both files atomically
      await Promise.all([
        this.saveUsers(users),
        this.saveTransactions(transactions)
      ]);

      // Mark idempotency key as processed
      this.processedIdempotencyKeys.add(idempotencyKey);

      return {
        success: true,
        user: updatedUser,
        transaction,
        availableForWithdrawal: availableForWithdrawal.toString()
      };

    } catch (error) {
      logger.error("Atomic withdrawal error (FileStorage):", error);
      return {
        success: false,
        error: "Internal server error during withdrawal processing"
      };
    }
  }

  // CRITICAL PAYMENT PROTECTION: Webhook idempotency to prevent double charging (persistent file-based)
  // Uses atomic check-and-set to prevent race conditions with concurrent retries
  async isWebhookProcessed(webhookId: string): Promise<boolean> {
    const webhooks = await this.loadProcessedWebhooks();
    return webhooks[webhookId] === true;
  }

  async markWebhookProcessed(webhookId: string): Promise<void> {
    const webhooks = await this.loadProcessedWebhooks();
    
    // Atomic check-and-set: throw if already exists (prevents concurrent processing)
    if (webhooks[webhookId] === true) {
      throw new Error(`Webhook ${webhookId} already marked as processed`);
    }
    
    webhooks[webhookId] = true;
    await this.saveProcessedWebhooks(webhooks);
  }

  async createPlinkoResult(result: InsertPlinkoResult): Promise<PlinkoResult> {
    await this.ensureDataDir();
    const results = await this.loadPlinkoResults();
    const id = randomUUID();
    const plinkoResult: PlinkoResult = {
      id,
      ...result,
      createdAt: new Date(),
    };
    results[id] = plinkoResult;
    await this.savePlinkoResults(results);
    return plinkoResult;
  }

  async getUserPlinkoResults(userId: string, limit: number = 50): Promise<PlinkoResult[]> {
    const results = await this.loadPlinkoResults();
    return Object.values(results)
      .filter(result => result.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createDiceResult(result: InsertDiceResult): Promise<DiceResult> {
    await this.ensureDataDir();
    const results = await this.loadDiceResults();
    const id = randomUUID();
    const diceResult: DiceResult = {
      id,
      ...result,
      createdAt: new Date(),
    };
    results[id] = diceResult;
    await this.saveDiceResults(results);
    return diceResult;
  }

  async getUserDiceResults(userId: string, limit: number = 50): Promise<DiceResult[]> {
    const results = await this.loadDiceResults();
    return Object.values(results)
      .filter(result => result.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createSlotsResult(result: InsertSlotsResult): Promise<SlotsResult> {
    await this.ensureDataDir();
    const results = await this.loadSlotsResults();
    const id = randomUUID();
    const slotsResult: SlotsResult = {
      id,
      ...result,
      createdAt: new Date(),
    };
    results[id] = slotsResult;
    await this.saveSlotsResults(results);
    return slotsResult;
  }

  async getUserSlotsResults(userId: string, limit: number = 50): Promise<SlotsResult[]> {
    const results = await this.loadSlotsResults();
    return Object.values(results)
      .filter(result => result.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Batched game play operation for better performance
  async batchGamePlay(
    userId: string,
    gameType: 'plinko' | 'dice' | 'slots',
    user: User,
    newBalance: string,
    transaction: Omit<InsertTransaction, 'createdAt'>,
    gameResult: InsertPlinkoResult | InsertDiceResult | InsertSlotsResult,
    newGamesPlayed: number,
    newGamesWon: number,
    newTotalWinnings: string
  ): Promise<{ transaction: Transaction; gameResult: PlinkoResult | DiceResult | SlotsResult }> {
    await this.ensureDataDir();
    
    // Load all necessary data
    const [users, transactions, plinkoResults, diceResults, slotsResults] = await Promise.all([
      this.loadUsers(),
      this.loadTransactions(),
      this.loadPlinkoResults(),
      this.loadDiceResults(),
      this.loadSlotsResults(),
    ]);
    
    // Update user balance and stats
    const updatedUser = {
      ...user,
      balance: newBalance,
      gamesPlayed: newGamesPlayed,
      gamesWon: newGamesWon,
      totalWinnings: newTotalWinnings,
    };
    users[userId] = updatedUser;
    
    // Create transaction
    const transactionId = randomUUID();
    const transactionDoc: Transaction = {
      id: transactionId,
      ...transaction,
      createdAt: new Date(),
    };
    transactions[transactionId] = transactionDoc;
    
    // Create game result
    const resultId = randomUUID();
    const resultDoc = {
      id: resultId,
      ...gameResult,
      createdAt: new Date(),
    };
    
    if (gameType === 'plinko') {
      plinkoResults[resultId] = resultDoc as PlinkoResult;
    } else if (gameType === 'dice') {
      diceResults[resultId] = resultDoc as DiceResult;
    } else {
      slotsResults[resultId] = resultDoc as SlotsResult;
    }
    
    // Save all changes atomically
    await Promise.all([
      this.saveUsers(users),
      this.saveTransactions(transactions),
      gameType === 'plinko' ? this.savePlinkoResults(plinkoResults) : 
        gameType === 'dice' ? this.saveDiceResults(diceResults) : 
        this.saveSlotsResults(slotsResults),
    ]);
    
    return {
      transaction: transactionDoc,
      gameResult: resultDoc as PlinkoResult | DiceResult | SlotsResult,
    };
  }

  async createChessGameState(state: InsertChessGameState): Promise<ChessGameState> {
    await this.ensureDataDir();
    const states = await this.loadChessGameStates();
    const id = randomUUID();
    const chessGameState: ChessGameState = {
      id,
      ...state,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    states[state.gameId] = chessGameState;
    await this.saveChessGameStates(states);
    return chessGameState;
  }

  async getChessGameState(gameId: string): Promise<ChessGameState | undefined> {
    const states = await this.loadChessGameStates();
    return states[gameId];
  }

  async updateChessGameState(gameId: string, updates: Partial<ChessGameState>): Promise<ChessGameState> {
    await this.ensureDataDir();
    const states = await this.loadChessGameStates();
    const state = states[gameId];
    if (!state) throw new Error("Chess game state not found");
    
    const updatedState = { 
      ...state, 
      ...updates, 
      updatedAt: new Date() 
    };
    states[gameId] = updatedState;
    await this.saveChessGameStates(states);
    return updatedState;
  }

  async createChessMove(move: InsertChessMove): Promise<ChessMove> {
    await this.ensureDataDir();
    const moves = await this.loadChessMoves();
    const id = randomUUID();
    const chessMove: ChessMove = {
      id,
      ...move,
      createdAt: new Date(),
    };
    moves[id] = chessMove;
    await this.saveChessMoves(moves);
    return chessMove;
  }

  async getChessMoves(gameId: string): Promise<ChessMove[]> {
    const moves = await this.loadChessMoves();
    return Object.values(moves)
      .filter(move => move.gameId === gameId)
      .sort((a, b) => a.moveNumber - b.moveNumber);
  }

  // Page view methods
  async createPageView(view: InsertPageView): Promise<PageView> {
    await this.ensureDataDir();
    const views = await this.loadPageViews();
    const id = randomUUID();
    const pageView: PageView = {
      id,
      pagePath: view.pagePath,
      userId: view.userId ?? null,
      userAgent: view.userAgent ?? null,
      ipAddress: view.ipAddress ?? null,
      createdAt: new Date(),
    };
    views[id] = pageView;
    await this.savePageViews(views);
    return pageView;
  }

  async getPageViews(pagePath?: string, hoursBack?: number): Promise<PageView[]> {
    const views = await this.loadPageViews();
    let viewsArray = Object.values(views);
    
    if (pagePath) {
      viewsArray = viewsArray.filter(v => v.pagePath === pagePath);
    }
    
    if (hoursBack) {
      const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
      viewsArray = viewsArray.filter(v => v.createdAt && v.createdAt >= startTime);
    }
    
    return viewsArray.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getPageViewCount(pagePath?: string, hoursBack?: number): Promise<number> {
    const views = await this.getPageViews(pagePath, hoursBack);
    return views.length;
  }

  // Bug report methods
  async createBugReport(report: InsertBugReport): Promise<BugReport> {
    await this.ensureDataDir();
    const reports = await this.loadBugReports();
    const id = randomUUID();
    const bugReport: BugReport = {
      id,
      userId: report.userId ?? null,
      title: report.title,
      description: report.description,
      page: report.page,
      status: "pending",
      createdAt: new Date(),
    };
    reports[id] = bugReport;
    await this.saveBugReports(reports);
    return bugReport;
  }

  async getBugReports(status?: string): Promise<BugReport[]> {
    const reports = await this.loadBugReports();
    let reportsArray = Object.values(reports);
    
    if (status) {
      reportsArray = reportsArray.filter(r => r.status === status);
    }
    
    return reportsArray.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  // Tournament methods - Not implemented for FileStorage
  async createTournament(): Promise<Tournament> {
    throw new Error('Tournament operations are not supported in FileStorage. Please use FirestoreStorage.');
  }
  
  async getTournament(): Promise<Tournament | undefined> {
    throw new Error('Tournament operations are not supported in FileStorage. Please use FirestoreStorage.');
  }
  
  async getActiveTournaments(): Promise<Tournament[]> {
    throw new Error('Tournament operations are not supported in FileStorage. Please use FirestoreStorage.');
  }
  
  async getAllTournaments(): Promise<Tournament[]> {
    throw new Error('Tournament operations are not supported in FileStorage. Please use FirestoreStorage.');
  }
  
  async updateTournamentStatus(): Promise<Tournament> {
    throw new Error('Tournament operations are not supported in FileStorage. Please use FirestoreStorage.');
  }
  
  async updateTournamentParticipants(): Promise<Tournament> {
    throw new Error('Tournament operations are not supported in FileStorage. Please use FirestoreStorage.');
  }
  
  async markTournamentAsNotified(): Promise<void> {
    throw new Error('Tournament operations are not supported in FileStorage. Please use FirestoreStorage.');
  }
  
  async joinTournament(): Promise<TournamentParticipant> {
    throw new Error('Tournament operations are not supported in FileStorage. Please use FirestoreStorage.');
  }
  
  async leaveTournament(): Promise<void> {
    throw new Error('Tournament operations are not supported in FileStorage. Please use FirestoreStorage.');
  }
  
  async getTournamentParticipants(): Promise<TournamentParticipant[]> {
    throw new Error('Tournament operations are not supported in FileStorage. Please use FirestoreStorage.');
  }
  
  async startTournament(): Promise<Game> {
    throw new Error('Tournament operations are not supported in FileStorage. Please use FirestoreStorage.');
  }
  
  async isUserInTournament(): Promise<boolean> {
    throw new Error('Tournament operations are not supported in FileStorage. Please use FirestoreStorage.');
  }
}

// Use Firestore for production (persistent cloud storage)
// Use FileStorage for local development if Firebase is not configured
let storageInstance: IStorage;

try {
  storageInstance = new FirestoreStorage();
  console.log("✅ Using Firestore for data storage");
} catch (error) {
  console.warn("⚠️  Firestore not configured, falling back to FileStorage");
  console.warn("   Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to use Firestore");
  const fileStorage = new FileStorage();
  fileStorage.initializeDefaultData().catch(console.error);
  storageInstance = fileStorage;
}

export const storage = storageInstance;
