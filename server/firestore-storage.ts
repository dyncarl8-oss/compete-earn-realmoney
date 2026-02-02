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
import { logger } from "./logger";
import { MoneyAmount, calculateWinnings, calculateWithdrawn } from "./decimal-utils";
import { type IStorage, type WithdrawalResult } from "./storage";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import memoizee from "memoizee";

export class FirestoreStorage implements IStorage {
  private db: Firestore;
  private withdrawalLocks: Map<string, Promise<WithdrawalResult>>;
  private processedIdempotencyKeys: Set<string>;
  private processedWebhooks: Set<string>;
  
  // Cached methods for performance
  private _getUserCached: (id: string) => Promise<User | undefined>;
  private _getGameCached: (id: string) => Promise<Game | undefined>;
  private _getGameParticipantsCached: (gameId: string) => Promise<GameParticipant[]>;

  constructor() {
    // Initialize Firebase Admin if not already initialized
    if (getApps().length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
          "Missing Firebase credentials. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables."
        );
      }

      // Handle both escaped newlines (\n as string) and actual newlines
      // Replace literal \n with actual newlines, but preserve existing newlines
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }

      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    this.db = getFirestore();
    this.withdrawalLocks = new Map();
    this.processedIdempotencyKeys = new Set();
    this.processedWebhooks = new Set();
    
    // Initialize cached methods with 10 second cache
    this._getUserCached = memoizee(this._getUserUncached.bind(this), {
      maxAge: 10000, // 10 seconds
      promise: true,
      primitive: true
    });
    
    this._getGameCached = memoizee(this._getGameUncached.bind(this), {
      maxAge: 10000, // 10 seconds
      promise: true,
      primitive: true
    });
    
    this._getGameParticipantsCached = memoizee(this._getGameParticipantsUncached.bind(this), {
      maxAge: 5000, // 5 seconds (shorter for active game data)
      promise: true,
      primitive: true
    });
  }

  // Helper method to convert Firestore timestamp to Date
  private convertTimestamps<T>(data: any): T {
    if (!data) return data;
    
    const converted = { ...data };
    for (const key in converted) {
      if (converted[key] && typeof converted[key] === 'object') {
        if (converted[key]._seconds !== undefined) {
          converted[key] = new Date(converted[key]._seconds * 1000);
        }
      }
    }
    return converted as T;
  }
  
  // Cache invalidation helpers
  private clearUserCache(userId: string) {
    (this._getUserCached as any).delete(userId);
  }
  
  private clearGameCache(gameId: string) {
    (this._getGameCached as any).delete(gameId);
    (this._getGameParticipantsCached as any).delete(gameId);
  }

  // Uncached internal methods
  private async _getUserUncached(id: string): Promise<User | undefined> {
    const doc = await this.db.collection('users').doc(id).get();
    if (!doc.exists) return undefined;
    return this.convertTimestamps<User>({ id: doc.id, ...doc.data() });
  }

  // User operations (now using cache)
  async getUser(id: string): Promise<User | undefined> {
    return this._getUserCached(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const snapshot = await this.db.collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();
    
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return this.convertTimestamps<User>({ id: doc.id, ...doc.data() });
  }

  async getAllUsers(): Promise<User[]> {
    const snapshot = await this.db.collection('users').get();
    return snapshot.docs.map(doc => 
      this.convertTimestamps<User>({ id: doc.id, ...doc.data() })
    );
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
      lastActivity: null,
      createdAt: new Date(),
    };
    
    await this.db.collection('users').doc(id).set(user);
    return user;
  }

  async createOrGetUser(id: string, profile: InsertUser): Promise<User> {
    const existingUser = await this.getUser(id);
    if (existingUser) {
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
      
      if (Object.keys(updates).length > 0) {
        return await this.updateUser(id, updates);
      }
      
      return existingUser;
    }
    return await this.createUser({ ...profile, id });
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    await this.db.collection('users').doc(id).update(updates);
    this.clearUserCache(id); // Clear cache after update
    const user = await this.getUser(id);
    if (!user) throw new Error("User not found after update");
    return user;
  }

  async updateUserBalance(userId: string, newBalance: string): Promise<User> {
    await this.db.collection('users').doc(userId).update({ balance: newBalance });
    this.clearUserCache(userId); // Clear cache after update
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    return user;
  }

  async updateUserStats(userId: string, gamesPlayed: number, gamesWon: number, totalWinnings: string): Promise<User> {
    await this.db.collection('users').doc(userId).update({
      gamesPlayed,
      gamesWon,
      totalWinnings,
    });
    this.clearUserCache(userId); // Clear cache after update
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    return user;
  }

  async updateUserActivity(userId: string): Promise<User | undefined> {
    await this.db.collection('users').doc(userId).update({
      lastActivity: new Date(),
    });
    this.clearUserCache(userId); // Clear cache after update
    return await this.getUser(userId);
  }

  // Atomic withdrawal operations
  async atomicWithdrawal(userId: string, amount: string, idempotencyKey: string): Promise<WithdrawalResult> {
    if (this.processedIdempotencyKeys.has(idempotencyKey)) {
      return {
        success: false,
        error: "Withdrawal already processed with this idempotency key",
      };
    }

    if (this.withdrawalLocks.has(userId)) {
      logger.info(`Withdrawal already in progress for user ${userId}, waiting...`);
      return await this.withdrawalLocks.get(userId)!;
    }

    const withdrawalPromise = this._performWithdrawal(userId, amount, idempotencyKey);
    this.withdrawalLocks.set(userId, withdrawalPromise);

    try {
      const result = await withdrawalPromise;
      return result;
    } finally {
      this.withdrawalLocks.delete(userId);
    }
  }

  private async _performWithdrawal(userId: string, amount: string, idempotencyKey: string): Promise<WithdrawalResult> {
    try {
      const result = await this.db.runTransaction(async (transaction) => {
        const userRef = this.db.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          return { success: false, error: "User not found" };
        }

        const user = this.convertTimestamps<User>({ id: userDoc.id, ...userDoc.data() });
        const requestedAmount = new MoneyAmount(amount);
        const currentBalance = new MoneyAmount(user.balance);

        // Check if user has sufficient balance for withdrawal
        if (requestedAmount.isGreaterThan(currentBalance)) {
          return {
            success: false,
            error: "Insufficient balance",
            availableForWithdrawal: currentBalance.toString(),
          };
        }

        const newBalance = currentBalance.subtract(requestedAmount);
        transaction.update(userRef, { balance: newBalance.toString() });

        const transactionId = randomUUID();
        const withdrawalTransaction: Transaction = {
          id: transactionId,
          userId,
          type: "withdrawal",
          amount: `-${amount}`,
          description: "Withdrawal",
          gameId: null,
          balanceAfter: newBalance.toString(),
          createdAt: new Date(),
        };

        transaction.set(this.db.collection('transactions').doc(transactionId), withdrawalTransaction);

        return {
          success: true,
          user: { ...user, balance: newBalance.toString() },
          transaction: withdrawalTransaction,
          availableForWithdrawal: newBalance.toString(),
        };
      });

      if (result.success) {
        this.processedIdempotencyKeys.add(idempotencyKey);
        this.clearUserCache(userId); // Clear cache after successful withdrawal
      }

      return result;
    } catch (error) {
      logger.error("Withdrawal transaction failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during withdrawal",
      };
    }
  }

  // CRITICAL PAYMENT PROTECTION: Webhook idempotency to prevent double charging
  // Uses atomic check-and-set to prevent race conditions with concurrent retries
  async isWebhookProcessed(webhookId: string): Promise<boolean> {
    const webhookDoc = await this.db.collection('processedWebhooks').doc(webhookId).get();
    return webhookDoc.exists;
  }

  async markWebhookProcessed(webhookId: string): Promise<void> {
    // Use create() instead of set() - this will fail if document already exists
    // This ensures atomic check-and-set behavior to prevent concurrent processing
    try {
      await this.db.collection('processedWebhooks').doc(webhookId).create({
        processedAt: new Date(),
        webhookId
      });
    } catch (error: any) {
      // If document already exists (code 6 = ALREADY_EXISTS), re-throw to prevent double processing
      if (error?.code === 6) {
        logger.info(`Webhook ${webhookId} already marked as processed (concurrent retry detected)`);
        throw new Error(`Webhook ${webhookId} already processed`);
      } else {
        // Unexpected error - rethrow
        throw error;
      }
    }
  }

  // Game operations
  async createGame(insertGame: InsertGame): Promise<Game> {
    const id = randomUUID();
    
    // Calculate prize amount: entry fee × max players × 75% (25% total commission split between platform and admin)
    const prizePoolRate = 0.75; // 75% goes to prize pool (15% platform + 10% admin = 25% total commission)
    const totalEntryFees = parseFloat(insertGame.entryFee) * insertGame.maxPlayers;
    const prizeAmount = (totalEntryFees * prizePoolRate).toFixed(2);
    
    const game: Game = {
      id,
      name: insertGame.name,
      gameType: insertGame.gameType,
      entryFee: insertGame.entryFee,
      maxPlayers: insertGame.maxPlayers,
      totalRounds: insertGame.totalRounds,
      gameMode: insertGame.gameMode,
      aiOpponents: insertGame.aiOpponents,
      status: 'open',
      currentPlayers: 0,
      prizeAmount,
      winnerId: null,
      currentRound: 1,
      currentTurnPlayerId: null,
      tournamentId: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
    };
    
    logger.info(`Created game ${id} with entry fee $${insertGame.entryFee}, max players ${insertGame.maxPlayers}, prize pool $${prizeAmount}`);
    
    await this.db.collection('games').doc(id).set(game);
    return game;
  }
  
  // Uncached internal method for games
  private async _getGameUncached(id: string): Promise<Game | undefined> {
    const doc = await this.db.collection('games').doc(id).get();
    if (!doc.exists) return undefined;
    return this.convertTimestamps<Game>({ id: doc.id, ...doc.data() });
  }

  async getGame(id: string): Promise<Game | undefined> {
    return this._getGameCached(id);
  }

  async getAvailableGames(): Promise<Game[]> {
    const snapshot = await this.db.collection('games')
      .where('status', 'in', ['open', 'filling'])
      .get();
    
    return snapshot.docs.map(doc => 
      this.convertTimestamps<Game>({ id: doc.id, ...doc.data() })
    );
  }

  async getUserActiveGame(userId: string): Promise<Game | undefined> {
    const participantsSnapshot = await this.db.collection('game_participants')
      .where('userId', '==', userId)
      .get();
    
    if (participantsSnapshot.empty) return undefined;

    for (const participantDoc of participantsSnapshot.docs) {
      const participant = participantDoc.data() as GameParticipant;
      const game = await this.getGame(participant.gameId);
      
      if (game && (game.status === 'running' || game.status === 'filling')) {
        return game;
      }
    }

    return undefined;
  }

  async updateGameStatus(gameId: string, status: string, winnerId?: string): Promise<Game> {
    const updates: any = { status };
    if (winnerId) updates.winnerId = winnerId;
    if (status === 'running') updates.startedAt = new Date();
    if (status === 'completed') updates.completedAt = new Date();
    
    await this.db.collection('games').doc(gameId).update(updates);
    this.clearGameCache(gameId); // Clear cache after update
    const game = await this.getGame(gameId);
    if (!game) throw new Error("Game not found");
    return game;
  }

  async updateGamePlayers(gameId: string, currentPlayers: number): Promise<Game> {
    await this.db.collection('games').doc(gameId).update({ currentPlayers });
    this.clearGameCache(gameId); // Clear cache after update
    const game = await this.getGame(gameId);
    if (!game) throw new Error("Game not found");
    return game;
  }

  async updateGameTurn(gameId: string, currentRound: number, currentTurnPlayerId: string): Promise<Game> {
    await this.db.collection('games').doc(gameId).update({
      currentRound,
      currentTurnPlayerId,
    });
    this.clearGameCache(gameId); // Clear cache after update
    const game = await this.getGame(gameId);
    if (!game) throw new Error("Game not found");
    return game;
  }

  // Game participant operations
  async addGameParticipant(gameId: string, userId: string): Promise<GameParticipant> {
    const id = randomUUID();
    const participant: GameParticipant = {
      id,
      gameId,
      userId,
      joinedAt: new Date(),
    };
    
    await this.db.collection('game_participants').doc(id).set(participant);
    this.clearGameCache(gameId); // Clear cache when participants change
    return participant;
  }
  
  // Uncached internal method for game participants
  private async _getGameParticipantsUncached(gameId: string): Promise<GameParticipant[]> {
    const snapshot = await this.db.collection('game_participants')
      .where('gameId', '==', gameId)
      .get();
    
    return snapshot.docs.map(doc => 
      this.convertTimestamps<GameParticipant>({ id: doc.id, ...doc.data() })
    );
  }
  
  async getGameParticipants(gameId: string): Promise<GameParticipant[]> {
    return this._getGameParticipantsCached(gameId);
  }

  async removeGameParticipant(gameId: string, userId: string): Promise<void> {
    const snapshot = await this.db.collection('game_participants')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.delete();
      this.clearGameCache(gameId); // Clear cache when participants change
    }
  }

  // Transaction operations
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = {
      id,
      ...insertTransaction,
      gameId: insertTransaction.gameId || null,
      createdAt: new Date(),
    };
    
    await this.db.collection('transactions').doc(id).set(transaction);
    return transaction;
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    const snapshot = await this.db.collection('transactions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => 
      this.convertTimestamps<Transaction>({ id: doc.id, ...doc.data() })
    );
  }

  async getAllTransactions(): Promise<Transaction[]> {
    const snapshot = await this.db.collection('transactions')
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => 
      this.convertTimestamps<Transaction>({ id: doc.id, ...doc.data() })
    );
  }

  // Yahtzee-specific operations
  async createYahtzeePlayerState(insertState: InsertYahtzeePlayerState): Promise<YahtzeePlayerState> {
    const id = randomUUID();
    const state: YahtzeePlayerState = {
      id,
      gameId: insertState.gameId,
      userId: insertState.userId,
      ones: insertState.ones ?? -1,
      twos: insertState.twos ?? -1,
      threes: insertState.threes ?? -1,
      fours: insertState.fours ?? -1,
      fives: insertState.fives ?? -1,
      sixes: insertState.sixes ?? -1,
      upperSectionBonus: insertState.upperSectionBonus ?? 0,
      threeOfAKind: insertState.threeOfAKind ?? -1,
      fourOfAKind: insertState.fourOfAKind ?? -1,
      fullHouse: insertState.fullHouse ?? -1,
      smallStraight: insertState.smallStraight ?? -1,
      largeStraight: insertState.largeStraight ?? -1,
      yahtzee: insertState.yahtzee ?? -1,
      yahtzeeBonus: insertState.yahtzeeBonus ?? 0,
      chance: insertState.chance ?? -1,
      totalScore: insertState.totalScore ?? 0,
      turnsCompleted: insertState.turnsCompleted ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await this.db.collection('yahtzee_player_states').doc(id).set(state);
    return state;
  }

  async getYahtzeePlayerState(gameId: string, userId: string): Promise<YahtzeePlayerState | undefined> {
    const snapshot = await this.db.collection('yahtzee_player_states')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .limit(1)
      .get();
    
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return this.convertTimestamps<YahtzeePlayerState>({ id: doc.id, ...doc.data() });
  }

  async updateYahtzeePlayerState(gameId: string, userId: string, updates: Partial<YahtzeePlayerState>): Promise<YahtzeePlayerState> {
    const state = await this.getYahtzeePlayerState(gameId, userId);
    if (!state) throw new Error("Yahtzee player state not found");
    
    await this.db.collection('yahtzee_player_states').doc(state.id).update({
      ...updates,
      updatedAt: new Date(),
    });
    
    const updatedState = await this.getYahtzeePlayerState(gameId, userId);
    if (!updatedState) throw new Error("Failed to update Yahtzee player state");
    return updatedState;
  }

  async getYahtzeeGameStates(gameId: string): Promise<YahtzeePlayerState[]> {
    const snapshot = await this.db.collection('yahtzee_player_states')
      .where('gameId', '==', gameId)
      .get();
    
    return snapshot.docs.map(doc => 
      this.convertTimestamps<YahtzeePlayerState>({ id: doc.id, ...doc.data() })
    );
  }

  async createYahtzeeTurn(insertTurn: InsertYahtzeeTurn): Promise<YahtzeeTurn> {
    const id = randomUUID();
    const turn: YahtzeeTurn = {
      id,
      gameId: insertTurn.gameId,
      userId: insertTurn.userId,
      round: insertTurn.round,
      rollCount: insertTurn.rollCount || 0,
      dice1: insertTurn.dice1 ?? 1,
      dice2: insertTurn.dice2 ?? 1,
      dice3: insertTurn.dice3 ?? 1,
      dice4: insertTurn.dice4 ?? 1,
      dice5: insertTurn.dice5 ?? 1,
      hold1: insertTurn.hold1 ?? false,
      hold2: insertTurn.hold2 ?? false,
      hold3: insertTurn.hold3 ?? false,
      hold4: insertTurn.hold4 ?? false,
      hold5: insertTurn.hold5 ?? false,
      isCompleted: insertTurn.isCompleted ?? false,
      scoredCategory: insertTurn.scoredCategory ?? null,
      scoredPoints: insertTurn.scoredPoints ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await this.db.collection('yahtzee_turns').doc(id).set(turn);
    return turn;
  }

  async getCurrentYahtzeeTurn(gameId: string, userId: string): Promise<YahtzeeTurn | undefined> {
    const snapshot = await this.db.collection('yahtzee_turns')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('isCompleted', '==', false)
      .limit(1)
      .get();
    
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    return this.convertTimestamps<YahtzeeTurn>({ id: doc.id, ...doc.data() });
  }

  async updateYahtzeeTurn(turnId: string, updates: Partial<YahtzeeTurn>): Promise<YahtzeeTurn> {
    await this.db.collection('yahtzee_turns').doc(turnId).update({
      ...updates,
      updatedAt: new Date(),
    });
    
    const doc = await this.db.collection('yahtzee_turns').doc(turnId).get();
    if (!doc.exists) throw new Error("Turn not found");
    return this.convertTimestamps<YahtzeeTurn>({ id: doc.id, ...doc.data() });
  }

  async completeYahtzeeTurn(turnId: string, category: string, points: number): Promise<YahtzeeTurn> {
    await this.db.collection('yahtzee_turns').doc(turnId).update({
      isCompleted: true,
      scoredCategory: category,
      scoredPoints: points,
      updatedAt: new Date(),
    });
    
    const doc = await this.db.collection('yahtzee_turns').doc(turnId).get();
    if (!doc.exists) throw new Error("Turn not found");
    return this.convertTimestamps<YahtzeeTurn>({ id: doc.id, ...doc.data() });
  }

  // Match result operations
  async saveMatchResult(insertResult: InsertMatchResult, insertPlayers: InsertMatchResultPlayer[]): Promise<MatchResult> {
    const resultId = randomUUID();
    const result: MatchResult = {
      id: resultId,
      gameId: insertResult.gameId,
      winnerId: insertResult.winnerId,
      prizeAmount: insertResult.prizeAmount,
      completedAt: new Date(),
    };
    
    await this.db.collection('match_results').doc(resultId).set(result);
    
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
        forfeited: insertPlayer.forfeited ?? false,
      };
      await this.db.collection('match_result_players').doc(playerId).set(player);
    }
    
    return result;
  }

  async getGameFinalResults(gameId: string): Promise<MatchResultWithPlayers | undefined> {
    const snapshot = await this.db.collection('match_results')
      .where('gameId', '==', gameId)
      .limit(1)
      .get();
    
    if (snapshot.empty) return undefined;
    
    const resultDoc = snapshot.docs[0];
    const result = this.convertTimestamps<MatchResult>({ id: resultDoc.id, ...resultDoc.data() });
    
    const playersSnapshot = await this.db.collection('match_result_players')
      .where('matchResultId', '==', result.id)
      .get();
    
    const players = playersSnapshot.docs.map(doc => 
      this.convertTimestamps<MatchResultPlayer>({ id: doc.id, ...doc.data() })
    );
    
    return { ...result, players };
  }

  async getUserMatchHistory(userId: string, limit: number = 10, offset: number = 0): Promise<MatchResultWithPlayers[]> {
    const playersSnapshot = await this.db.collection('match_result_players')
      .where('userId', '==', userId)
      .get();
    
    const results: MatchResultWithPlayers[] = [];
    
    for (const playerDoc of playersSnapshot.docs) {
      const player = this.convertTimestamps<MatchResultPlayer>({ id: playerDoc.id, ...playerDoc.data() });
      
      const resultDoc = await this.db.collection('match_results').doc(player.matchResultId).get();
      if (resultDoc.exists) {
        const result = this.convertTimestamps<MatchResult>({ id: resultDoc.id, ...resultDoc.data() });
        
        const allPlayersSnapshot = await this.db.collection('match_result_players')
          .where('matchResultId', '==', result.id)
          .get();
        
        const allPlayers = allPlayersSnapshot.docs.map(doc => 
          this.convertTimestamps<MatchResultPlayer>({ id: doc.id, ...doc.data() })
        );
        
        results.push({ ...result, players: allPlayers });
      }
    }
    
    results.sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA;
    });
    
    return results.slice(offset, offset + limit);
  }

  // Game invitation operations
  async createGameInvitation(insertInvitation: InsertGameInvitation): Promise<GameInvitation> {
    const id = randomUUID();
    const invitation: GameInvitation = {
      id,
      gameId: insertInvitation.gameId,
      fromUserId: insertInvitation.fromUserId,
      toUserId: insertInvitation.toUserId,
      message: insertInvitation.message ?? null,
      status: insertInvitation.status || 'pending',
      expiresAt: insertInvitation.expiresAt,
      respondedAt: null,
      createdAt: new Date(),
    };
    
    await this.db.collection('game_invitations').doc(id).set(invitation);
    return invitation;
  }

  async getGameInvitation(id: string): Promise<GameInvitation | undefined> {
    const doc = await this.db.collection('game_invitations').doc(id).get();
    if (!doc.exists) return undefined;
    return this.convertTimestamps<GameInvitation>({ id: doc.id, ...doc.data() });
  }

  async getUserInvitations(userId: string, status?: string): Promise<GameInvitation[]> {
    const snapshot = await this.db.collection('game_invitations')
      .where('invitedUserId', '==', userId)
      .get();
    
    let invitations = snapshot.docs.map(doc => 
      this.convertTimestamps<GameInvitation>({ id: doc.id, ...doc.data() })
    );
    
    if (status) {
      invitations = invitations.filter(inv => inv.status === status);
    }
    
    invitations.sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return bTime - aTime;
    });
    
    return invitations;
  }

  async updateInvitationStatus(id: string, status: string, respondedAt?: Date): Promise<GameInvitation> {
    const updates: any = { status };
    if (respondedAt) updates.respondedAt = respondedAt;
    
    await this.db.collection('game_invitations').doc(id).update(updates);
    
    const invitation = await this.getGameInvitation(id);
    if (!invitation) throw new Error("Invitation not found");
    return invitation;
  }

  async expireOldInvitations(): Promise<void> {
    const expirationTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snapshot = await this.db.collection('game_invitations')
      .where('status', '==', 'pending')
      .get();
    
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      if (createdAt < expirationTime) {
        batch.update(doc.ref, { status: 'expired' });
      }
    });
    
    if (snapshot.docs.length > 0) {
      await batch.commit();
    }
  }

  // Plinko game operations
  async createPlinkoResult(insertResult: InsertPlinkoResult): Promise<PlinkoResult> {
    const id = randomUUID();
    const result: PlinkoResult = {
      id,
      ...insertResult,
      createdAt: new Date(),
    };
    
    await this.db.collection('plinko_results').doc(id).set(result);
    return result;
  }

  async getUserPlinkoResults(userId: string, limit: number = 50): Promise<PlinkoResult[]> {
    const snapshot = await this.db.collection('plinko_results')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => 
      this.convertTimestamps<PlinkoResult>({ id: doc.id, ...doc.data() })
    );
  }

  // Dice game operations
  async createDiceResult(insertResult: InsertDiceResult): Promise<DiceResult> {
    const id = randomUUID();
    const result: DiceResult = {
      id,
      ...insertResult,
      createdAt: new Date(),
    };
    
    await this.db.collection('dice_results').doc(id).set(result);
    return result;
  }

  async getUserDiceResults(userId: string, limit: number = 50): Promise<DiceResult[]> {
    const snapshot = await this.db.collection('dice_results')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => 
      this.convertTimestamps<DiceResult>({ id: doc.id, ...doc.data() })
    );
  }

  // Slots game operations
  async createSlotsResult(insertResult: InsertSlotsResult): Promise<SlotsResult> {
    const id = randomUUID();
    const result: SlotsResult = {
      id,
      ...insertResult,
      createdAt: new Date(),
    };
    
    await this.db.collection('slots_results').doc(id).set(result);
    return result;
  }

  async getUserSlotsResults(userId: string, limit: number = 50): Promise<SlotsResult[]> {
    const snapshot = await this.db.collection('slots_results')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => 
      this.convertTimestamps<SlotsResult>({ id: doc.id, ...doc.data() })
    );
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
    const batch = this.db.batch();
    
    // Update user balance and stats
    const userRef = this.db.collection('users').doc(userId);
    batch.update(userRef, {
      balance: newBalance,
      gamesPlayed: newGamesPlayed,
      gamesWon: newGamesWon,
      totalWinnings: newTotalWinnings,
    });
    
    // Create transaction
    const transactionId = randomUUID();
    const transactionDoc: Transaction = {
      id: transactionId,
      type: transaction.type,
      userId: transaction.userId,
      amount: transaction.amount,
      description: transaction.description,
      gameId: transaction.gameId ?? null,
      balanceAfter: transaction.balanceAfter,
      createdAt: new Date(),
    };
    const transactionRef = this.db.collection('transactions').doc(transactionId);
    batch.set(transactionRef, transactionDoc);
    
    // Create game result
    const resultId = randomUUID();
    const resultDoc = {
      id: resultId,
      ...gameResult,
      createdAt: new Date(),
    };
    const collection = gameType === 'plinko' ? 'plinko_results' : 
                      gameType === 'dice' ? 'dice_results' : 'slots_results';
    const resultRef = this.db.collection(collection).doc(resultId);
    batch.set(resultRef, resultDoc);
    
    // Execute batch
    await batch.commit();
    
    // Clear cache
    this.clearUserCache(userId);
    
    return {
      transaction: transactionDoc,
      gameResult: resultDoc as PlinkoResult | DiceResult | SlotsResult,
    };
  }

  // Chess game operations
  async createChessGameState(insertState: InsertChessGameState): Promise<ChessGameState> {
    const state: ChessGameState = {
      id: insertState.gameId,
      gameId: insertState.gameId,
      boardState: insertState.boardState,
      whitePlayerId: insertState.whitePlayerId,
      blackPlayerId: insertState.blackPlayerId,
      currentTurn: insertState.currentTurn || 'white',
      gameStatus: insertState.gameStatus || 'in_progress',
      whiteKingsideCastle: insertState.whiteKingsideCastle ?? true,
      whiteQueensideCastle: insertState.whiteQueensideCastle ?? true,
      blackKingsideCastle: insertState.blackKingsideCastle ?? true,
      blackQueensideCastle: insertState.blackQueensideCastle ?? true,
      enPassantTarget: insertState.enPassantTarget ?? null,
      moveCount: insertState.moveCount ?? 0,
      halfmoveClock: insertState.halfmoveClock ?? 0,
      capturedPieces: insertState.capturedPieces || '[]',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await this.db.collection('chess_game_states').doc(insertState.gameId).set(state);
    return state;
  }

  async getChessGameState(gameId: string): Promise<ChessGameState | undefined> {
    const doc = await this.db.collection('chess_game_states').doc(gameId).get();
    if (!doc.exists) return undefined;
    return this.convertTimestamps<ChessGameState>(doc.data());
  }

  async updateChessGameState(gameId: string, updates: Partial<ChessGameState>): Promise<ChessGameState> {
    await this.db.collection('chess_game_states').doc(gameId).update({
      ...updates,
      updatedAt: new Date(),
    });
    
    const state = await this.getChessGameState(gameId);
    if (!state) throw new Error("Chess game state not found");
    return state;
  }

  async createChessMove(insertMove: InsertChessMove): Promise<ChessMove> {
    const id = randomUUID();
    const move: ChessMove = {
      id,
      gameId: insertMove.gameId,
      moveNumber: insertMove.moveNumber,
      playerId: insertMove.playerId,
      playerColor: insertMove.playerColor,
      fromSquare: insertMove.fromSquare,
      toSquare: insertMove.toSquare,
      piece: insertMove.piece,
      capturedPiece: insertMove.capturedPiece ?? null,
      isCheck: insertMove.isCheck ?? false,
      isCheckmate: insertMove.isCheckmate ?? false,
      isCastling: insertMove.isCastling ?? false,
      isEnPassant: insertMove.isEnPassant ?? false,
      promotion: insertMove.promotion ?? null,
      algebraicNotation: insertMove.algebraicNotation,
      createdAt: new Date(),
    };
    
    await this.db.collection('chess_moves').doc(id).set(move);
    return move;
  }

  async getChessMoves(gameId: string): Promise<ChessMove[]> {
    const snapshot = await this.db.collection('chess_moves')
      .where('gameId', '==', gameId)
      .orderBy('moveNumber', 'asc')
      .get();
    
    return snapshot.docs.map(doc => 
      this.convertTimestamps<ChessMove>({ id: doc.id, ...doc.data() })
    );
  }

  // Page view operations
  async createPageView(insertView: InsertPageView): Promise<PageView> {
    const id = randomUUID();
    const pageView: PageView = {
      id,
      pagePath: insertView.pagePath,
      userId: insertView.userId ?? null,
      userAgent: insertView.userAgent ?? null,
      ipAddress: insertView.ipAddress ?? null,
      createdAt: new Date(),
    };
    
    await this.db.collection('page_views').doc(id).set(pageView);
    return pageView;
  }

  async getPageViews(pagePath?: string, hoursBack?: number): Promise<PageView[]> {
    let query: any = this.db.collection('page_views');
    
    if (pagePath) {
      query = query.where('pagePath', '==', pagePath);
    }
    
    if (hoursBack) {
      const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
      query = query.where('createdAt', '>=', startTime);
    }
    
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    
    return snapshot.docs.map((doc: any) => 
      this.convertTimestamps<PageView>({ id: doc.id, ...doc.data() })
    );
  }

  async getPageViewCount(pagePath?: string, hoursBack?: number): Promise<number> {
    const views = await this.getPageViews(pagePath, hoursBack);
    return views.length;
  }

  // Bug report operations
  async createBugReport(insertReport: InsertBugReport): Promise<BugReport> {
    const id = randomUUID();
    const bugReport: BugReport = {
      id,
      userId: insertReport.userId ?? null,
      title: insertReport.title,
      description: insertReport.description,
      page: insertReport.page,
      status: "pending",
      createdAt: new Date(),
    };
    
    await this.db.collection('bug_reports').doc(id).set(bugReport);
    return bugReport;
  }

  async getBugReports(status?: string): Promise<BugReport[]> {
    let query: any = this.db.collection('bug_reports');
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    
    return snapshot.docs.map((doc: any) => 
      this.convertTimestamps<BugReport>({ id: doc.id, ...doc.data() })
    );
  }

  // Tournament operations
  async createTournament(insertTournament: InsertTournament): Promise<Tournament> {
    const id = randomUUID();
    const tournament: Tournament = {
      id,
      gameType: insertTournament.gameType,
      hostedBy: insertTournament.hostedBy,
      companyId: insertTournament.companyId || null,
      experienceId: insertTournament.experienceId || null,
      potAmount: insertTournament.potAmount,
      entryFee: insertTournament.entryFee,
      maxParticipants: insertTournament.maxParticipants || 10,
      currentParticipants: 0,
      status: "active",
      gameId: null,
      name: insertTournament.name,
      description: insertTournament.description || null,
      notificationSent: false,
      notificationSentAt: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
    };
    
    await this.db.collection('tournaments').doc(id).set(tournament);
    return tournament;
  }

  async getTournament(id: string): Promise<Tournament | undefined> {
    const doc = await this.db.collection('tournaments').doc(id).get();
    if (!doc.exists) return undefined;
    return this.convertTimestamps<Tournament>({ id: doc.id, ...doc.data() });
  }

  async getActiveTournaments(resourceId?: string): Promise<Tournament[]> {
    let query: any = this.db.collection('tournaments')
      .where('status', '==', 'active');
    
    if (resourceId) {
      query = query.where('experienceId', '==', resourceId);
    }
    
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    
    return snapshot.docs.map((doc: any) => 
      this.convertTimestamps<Tournament>({ id: doc.id, ...doc.data() })
    );
  }

  async getAllTournaments(resourceId?: string): Promise<Tournament[]> {
    let query: any = this.db.collection('tournaments');
    
    if (resourceId) {
      query = query.where('experienceId', '==', resourceId);
    }
    
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    
    return snapshot.docs.map((doc: any) => 
      this.convertTimestamps<Tournament>({ id: doc.id, ...doc.data() })
    );
  }

  async updateTournamentStatus(id: string, status: string): Promise<Tournament> {
    const tournamentRef = this.db.collection('tournaments').doc(id);
    const updates: Partial<Tournament> = { status };
    
    if (status === 'active') {
      updates.startedAt = new Date();
    } else if (status === 'completed' || status === 'cancelled') {
      updates.completedAt = new Date();
    }
    
    await tournamentRef.update(updates);
    const doc = await tournamentRef.get();
    return this.convertTimestamps<Tournament>({ id: doc.id, ...doc.data() });
  }

  async updateTournamentParticipants(id: string, currentParticipants: number): Promise<Tournament> {
    const tournamentRef = this.db.collection('tournaments').doc(id);
    await tournamentRef.update({ currentParticipants });
    const doc = await tournamentRef.get();
    return this.convertTimestamps<Tournament>({ id: doc.id, ...doc.data() });
  }

  async markTournamentAsNotified(id: string): Promise<void> {
    const tournamentRef = this.db.collection('tournaments').doc(id);
    await tournamentRef.update({ 
      notificationSent: true,
      notificationSentAt: new Date()
    });
  }

  // Tournament participant operations
  async joinTournament(tournamentId: string, userId: string): Promise<TournamentParticipant> {
    return await this.db.runTransaction(async (transaction) => {
      const tournamentRef = this.db.collection('tournaments').doc(tournamentId);
      const tournamentDoc = await transaction.get(tournamentRef);
      
      if (!tournamentDoc.exists) {
        throw new Error('Tournament not found');
      }
      
      const tournament = this.convertTimestamps<Tournament>({ id: tournamentDoc.id, ...tournamentDoc.data() });
      
      if (tournament.status !== 'active') {
        throw new Error('Tournament is not active');
      }
      
      // Use deterministic doc ID to enforce uniqueness at database level
      const participantId = `${tournamentId}_${userId}`;
      const participantRef = this.db.collection('tournament_participants').doc(participantId);
      const participantDoc = await transaction.get(participantRef);
      
      if (participantDoc.exists) {
        throw new Error('User already joined this tournament');
      }
      
      if (tournament.currentParticipants >= tournament.maxParticipants) {
        throw new Error('Tournament is full');
      }
      
      const participant: TournamentParticipant = {
        id: participantId,
        tournamentId,
        userId,
        joinedAt: new Date(),
      };
      
      transaction.set(participantRef, participant);
      transaction.update(tournamentRef, {
        currentParticipants: tournament.currentParticipants + 1
      });
      
      return participant;
    });
  }

  async leaveTournament(tournamentId: string, userId: string): Promise<void> {
    await this.db.runTransaction(async (transaction) => {
      const tournamentRef = this.db.collection('tournaments').doc(tournamentId);
      const tournamentDoc = await transaction.get(tournamentRef);
      
      if (!tournamentDoc.exists) {
        throw new Error('Tournament not found');
      }
      
      const tournament = this.convertTimestamps<Tournament>({ id: tournamentDoc.id, ...tournamentDoc.data() });
      
      // Use deterministic doc ID
      const participantId = `${tournamentId}_${userId}`;
      const participantRef = this.db.collection('tournament_participants').doc(participantId);
      const participantDoc = await transaction.get(participantRef);
      
      if (!participantDoc.exists) {
        throw new Error('User is not in this tournament');
      }
      
      transaction.delete(participantRef);
      transaction.update(tournamentRef, {
        currentParticipants: Math.max(0, tournament.currentParticipants - 1)
      });
    });
  }

  async getTournamentParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
    const snapshot = await this.db.collection('tournament_participants')
      .where('tournamentId', '==', tournamentId)
      .get();
    
    return snapshot.docs.map((doc: any) => 
      this.convertTimestamps<TournamentParticipant>({ id: doc.id, ...doc.data() })
    );
  }

  async isUserInTournament(tournamentId: string, userId: string): Promise<boolean> {
    const snapshot = await this.db.collection('tournament_participants')
      .where('tournamentId', '==', tournamentId)
      .where('userId', '==', userId)
      .limit(1)
      .get();
    
    return !snapshot.empty;
  }

  async startTournament(tournamentId: string): Promise<Game> {
    const tournament = await this.getTournament(tournamentId);
    
    if (!tournament) {
      throw new Error('Tournament not found');
    }
    
    if (tournament.status !== 'active') {
      throw new Error('Tournament is not active');
    }
    
    // Get all participants
    const participants = await this.getTournamentParticipants(tournamentId);
    
    if (participants.length === 0) {
      throw new Error('No participants in tournament');
    }
    
    // Deduct entry fees from all participants
    const entryFee = parseFloat(tournament.entryFee);
    for (const participant of participants) {
      const user = await this.getUser(participant.userId);
      if (!user) {
        throw new Error(`User ${participant.userId} not found`);
      }
      
      const currentBalance = parseFloat(user.balance);
      if (currentBalance < entryFee) {
        throw new Error(`User ${user.username} has insufficient balance for tournament entry`);
      }
      
      const newBalance = (currentBalance - entryFee).toFixed(2);
      await this.updateUserBalance(participant.userId, newBalance);
      
      // Create entry fee transaction
      await this.createTransaction({
        userId: participant.userId,
        type: "entry",
        amount: `-${tournament.entryFee}`,
        description: `${tournament.name} - Tournament Entry Fee`,
        gameId: null,
        balanceAfter: newBalance,
      });
      
      logger.info(`Deducted $${tournament.entryFee} entry fee from user ${participant.userId} for tournament ${tournamentId}`);
    }
    
    // Create a game for all participants
    const gameId = randomUUID();
    const totalEntryFees = parseFloat(tournament.entryFee) * participants.length;
    const prizePoolRate = 0.95; // 95% to prize pool (5% platform fee for tournaments)
    const prizeAmount = (totalEntryFees * prizePoolRate).toFixed(2);
    
    const game: Game = {
      id: gameId,
      name: `${tournament.name} - Match`,
      gameType: tournament.gameType,
      entryFee: tournament.entryFee,
      maxPlayers: participants.length,
      totalRounds: 13, // Default for Yahtzee
      gameMode: 'multiplayer',
      aiOpponents: 0,
      status: 'running',
      currentPlayers: participants.length,
      prizeAmount,
      winnerId: null,
      currentRound: 1,
      currentTurnPlayerId: participants[0]?.userId || null,
      tournamentId: tournamentId,
      createdAt: new Date(),
      startedAt: new Date(),
      completedAt: null,
    };
    
    await this.db.collection('games').doc(gameId).set(game);
    
    // Add all participants to the game
    for (const participant of participants) {
      const participantId = randomUUID();
      const gameParticipant = {
        id: participantId,
        gameId: gameId,
        userId: participant.userId,
        joinedAt: new Date(),
      };
      await this.db.collection('game_participants').doc(participantId).set(gameParticipant);
    }
    
    // Update tournament status to started and store the gameId
    await this.db.collection('tournaments').doc(tournamentId).update({
      status: 'started',
      gameId: gameId,
      startedAt: new Date()
    });
    
    logger.info(`Started tournament ${tournamentId}, created game ${gameId} with ${participants.length} players`);
    
    return game;
  }
}
