import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email"),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  profileImageUrl: text("profile_image_url"),
  gamesPlayed: integer("games_played").notNull().default(0),
  gamesWon: integer("games_won").notNull().default(0),
  totalWinnings: decimal("total_winnings", { precision: 10, scale: 2 }).notNull().default("0.00"),
  lastActivity: timestamp("last_activity"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const games = pgTable("games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  gameType: text("game_type").notNull().default("yahtzee"), // yahtzee, etc.
  entryFee: decimal("entry_fee", { precision: 10, scale: 2 }).notNull(),
  maxPlayers: integer("max_players").notNull().default(5),
  currentPlayers: integer("current_players").notNull().default(0),
  prizeAmount: decimal("prize_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("open"), // open, filling, running, completed
  winnerId: varchar("winner_id"),
  currentRound: integer("current_round").default(1),
  totalRounds: integer("total_rounds").notNull().default(13), // 13 rounds for complete Yahtzee
  currentTurnPlayerId: varchar("current_turn_player_id"),
  gameMode: text("game_mode").notNull().default("multiplayer"), // multiplayer, practice
  aiOpponents: integer("ai_opponents").notNull().default(0), // number of AI players
  tournamentId: varchar("tournament_id"), // link to tournament if this is a tournament game
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const gameParticipants = pgTable("game_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull(),
  userId: varchar("user_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const tournaments = pgTable("tournaments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameType: text("game_type").notNull(), // yahtzee, chess
  hostedBy: varchar("hosted_by").notNull(), // admin user ID
  companyId: varchar("company_id"), // whop company ID
  experienceId: varchar("experience_id"), // whop experience ID
  potAmount: decimal("pot_amount", { precision: 10, scale: 2 }).notNull(),
  entryFee: decimal("entry_fee", { precision: 10, scale: 2 }).notNull(),
  maxParticipants: integer("max_participants").notNull().default(10),
  currentParticipants: integer("current_participants").notNull().default(0),
  status: text("status").notNull().default("active"), // active, started, completed, cancelled
  gameId: varchar("game_id"), // ID of the game created when tournament starts
  name: text("name").notNull(),
  description: text("description"),
  notificationSent: boolean("notification_sent").notNull().default(false),
  notificationSentAt: timestamp("notification_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const tournamentParticipants = pgTable("tournament_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").notNull(),
  userId: varchar("user_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(), // deposit, entry, win, commission
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  gameId: varchar("game_id"),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Yahtzee-specific tables - Complete 13 categories
export const yahtzeePlayerStates = pgTable("yahtzee_player_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull(),
  userId: varchar("user_id").notNull(),
  // Upper Section Categories (count specific numbers)
  ones: integer("ones").default(-1), // -1 = not used, >= 0 = score
  twos: integer("twos").default(-1),
  threes: integer("threes").default(-1),
  fours: integer("fours").default(-1),
  fives: integer("fives").default(-1),
  sixes: integer("sixes").default(-1),
  upperSectionBonus: integer("upper_section_bonus").default(0), // 35 if upper >= 63
  // Lower Section Categories
  threeOfAKind: integer("three_of_a_kind").default(-1), // sum of all dice
  fourOfAKind: integer("four_of_a_kind").default(-1), // sum of all dice
  fullHouse: integer("full_house").default(-1), // 25 points or 0
  smallStraight: integer("small_straight").default(-1), // 30 points or 0
  largeStraight: integer("large_straight").default(-1), // 40 points or 0
  yahtzee: integer("yahtzee").default(-1), // 50 points or 0
  yahtzeeBonus: integer("yahtzee_bonus").default(0), // 100 for each additional yahtzee
  chance: integer("chance").default(-1), // sum of all dice
  totalScore: integer("total_score").default(0),
  turnsCompleted: integer("turns_completed").default(0), // Track completed turns (max 13)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const yahtzeeTurns = pgTable("yahtzee_turns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull(),
  userId: varchar("user_id").notNull(),
  round: integer("round").notNull(),
  rollCount: integer("roll_count").notNull().default(0), // 0, 1, 2, 3
  // Current dice values (1-6)
  dice1: integer("dice1").default(1),
  dice2: integer("dice2").default(1),
  dice3: integer("dice3").default(1),
  dice4: integer("dice4").default(1),
  dice5: integer("dice5").default(1),
  // Which dice are held (true = held, false = will reroll)
  hold1: boolean("hold1").default(false),
  hold2: boolean("hold2").default(false),
  hold3: boolean("hold3").default(false),
  hold4: boolean("hold4").default(false),
  hold5: boolean("hold5").default(false),
  isCompleted: boolean("is_completed").default(false),
  scoredCategory: text("scored_category"), // which category was chosen
  scoredPoints: integer("scored_points"), // points earned
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  profileImageUrl: true,
});

export const insertGameSchema = createInsertSchema(games).pick({
  name: true,
  gameType: true,
  entryFee: true,
  maxPlayers: true,
  totalRounds: true,
  gameMode: true,
  aiOpponents: true,
  tournamentId: true,
}).extend({
  name: z.string().min(1, "Game name is required").default("Yahtzee Table"),
  gameType: z.enum(["yahtzee", "chess"]).default("yahtzee"),
  entryFee: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid entry fee format").default("2.00"),
  maxPlayers: z.number().min(2).max(5).default(3),
  totalRounds: z.number().min(11).max(13).default(13), // 13 turns for complete Yahtzee
  gameMode: z.enum(["multiplayer", "practice"]).default("multiplayer"),
  aiOpponents: z.number().min(0).max(4).default(0), // 0-4 AI opponents
  tournamentId: z.string().optional(),
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  userId: true,
  type: true,
  amount: true,
  description: true,
  gameId: true,
  balanceAfter: true,
});

export const insertTournamentSchema = createInsertSchema(tournaments).pick({
  gameType: true,
  hostedBy: true,
  companyId: true,
  experienceId: true,
  potAmount: true,
  entryFee: true,
  maxParticipants: true,
  name: true,
  description: true,
}).extend({
  gameType: z.enum(["yahtzee", "chess"]),
  potAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid pot amount format"),
  entryFee: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid entry fee format"),
  maxParticipants: z.number().min(2).max(50).default(10),
  name: z.string().min(1, "Tournament name is required"),
});

// Insert schemas
export const insertYahtzeePlayerStateSchema = createInsertSchema(yahtzeePlayerStates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertYahtzeeTurnSchema = createInsertSchema(yahtzeeTurns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;
export type GameParticipant = typeof gameParticipants.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournaments.$inferSelect;
export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type YahtzeePlayerState = typeof yahtzeePlayerStates.$inferSelect;
export type InsertYahtzeePlayerState = z.infer<typeof insertYahtzeePlayerStateSchema>;
export type YahtzeeTurn = typeof yahtzeeTurns.$inferSelect;
export type InsertYahtzeeTurn = z.infer<typeof insertYahtzeeTurnSchema>;

// Complete Yahtzee scoring categories (13 categories)
export const YAHTZEE_CATEGORIES = {
  // Upper Section
  ones: 'ones',
  twos: 'twos',
  threes: 'threes',
  fours: 'fours',
  fives: 'fives',
  sixes: 'sixes',
  // Lower Section
  threeOfAKind: 'threeOfAKind',
  fourOfAKind: 'fourOfAKind',
  fullHouse: 'fullHouse',
  smallStraight: 'smallStraight',
  largeStraight: 'largeStraight',
  yahtzee: 'yahtzee',
  chance: 'chance'
} as const;

export type YahtzeeCategory = typeof YAHTZEE_CATEGORIES[keyof typeof YAHTZEE_CATEGORIES];

// Scoring values for fixed-point categories
export const YAHTZEE_FIXED_SCORES = {
  fullHouse: 25,
  smallStraight: 30,
  largeStraight: 40,
  yahtzee: 50
} as const;

// Game Invitations - for invitation system
export const gameInvitations = pgTable("game_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull(),
  fromUserId: varchar("from_user_id").notNull(), // User who sent the invitation
  toUserId: varchar("to_user_id").notNull(), // User who receives the invitation
  message: text("message"), // Optional invitation message
  status: text("status").notNull().default("pending"), // pending, accepted, declined, expired
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"), // When user accepted/declined
  expiresAt: timestamp("expires_at").notNull(), // Auto-expire after some time
});

// Match Results for history and final game screens
export const matchResults = pgTable("match_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull(),
  winnerId: varchar("winner_id").notNull(),
  prizeAmount: decimal("prize_amount", { precision: 10, scale: 2 }).notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const matchResultPlayers = pgTable("match_result_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchResultId: varchar("match_result_id").notNull(),
  userId: varchar("user_id").notNull(),
  username: text("username").notNull(),
  totalScore: integer("total_score").notNull(),
  rank: integer("rank").notNull(),
  entryFee: decimal("entry_fee", { precision: 10, scale: 2 }).notNull(),
  netChange: decimal("net_change", { precision: 10, scale: 2 }).notNull(),
  forfeited: boolean("forfeited").notNull().default(false),
});

export const insertMatchResultSchema = createInsertSchema(matchResults).omit({
  id: true,
  completedAt: true,
});

export const insertMatchResultPlayerSchema = createInsertSchema(matchResultPlayers).omit({
  id: true,
  matchResultId: true,
});

export const insertGameInvitationSchema = createInsertSchema(gameInvitations).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
});

// Types for game invitations
export type GameInvitation = typeof gameInvitations.$inferSelect;
export type InsertGameInvitation = z.infer<typeof insertGameInvitationSchema>;

// Types for match results
export type MatchResult = typeof matchResults.$inferSelect;
export type InsertMatchResult = z.infer<typeof insertMatchResultSchema>;
export type MatchResultPlayer = typeof matchResultPlayers.$inferSelect;
export type InsertMatchResultPlayer = z.infer<typeof insertMatchResultPlayerSchema>;

// Combined type for frontend consumption
export type MatchResultWithPlayers = MatchResult & {
  players: MatchResultPlayer[];
};

// Plinko Game Results - Solo instant game
export const plinkoResults = pgTable("plinko_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  betAmount: decimal("bet_amount", { precision: 10, scale: 2 }).notNull(),
  multiplier: decimal("multiplier", { precision: 10, scale: 2 }).notNull(),
  winAmount: decimal("win_amount", { precision: 10, scale: 2 }).notNull(),
  slotIndex: integer("slot_index").notNull(), // Which slot (0-8) the ball landed in
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Dice Game Results - Solo instant game
export const diceResults = pgTable("dice_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  betAmount: decimal("bet_amount", { precision: 10, scale: 2 }).notNull(),
  targetNumber: integer("target_number").notNull(), // 1-99
  rollType: text("roll_type").notNull(), // "over" or "under"
  rolledNumber: integer("rolled_number").notNull(), // 1-100
  multiplier: decimal("multiplier", { precision: 10, scale: 2 }).notNull(),
  winAmount: decimal("win_amount", { precision: 10, scale: 2 }).notNull(),
  won: boolean("won").notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlinkoResultSchema = createInsertSchema(plinkoResults).omit({
  id: true,
  createdAt: true,
});

export const insertDiceResultSchema = createInsertSchema(diceResults).omit({
  id: true,
  createdAt: true,
});

// Slots Game Results - Solo instant game
export const slotsResults = pgTable("slots_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  betAmount: decimal("bet_amount", { precision: 10, scale: 2 }).notNull(),
  reels: text("reels").notNull(), // JSON array of 3 symbols
  multiplier: decimal("multiplier", { precision: 10, scale: 2 }).notNull(),
  winAmount: decimal("win_amount", { precision: 10, scale: 2 }).notNull(),
  won: boolean("won").notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSlotsResultSchema = createInsertSchema(slotsResults).omit({
  id: true,
  createdAt: true,
});

export type PlinkoResult = typeof plinkoResults.$inferSelect;
export type InsertPlinkoResult = z.infer<typeof insertPlinkoResultSchema>;
export type DiceResult = typeof diceResults.$inferSelect;
export type InsertDiceResult = z.infer<typeof insertDiceResultSchema>;
export type SlotsResult = typeof slotsResults.$inferSelect;
export type InsertSlotsResult = z.infer<typeof insertSlotsResultSchema>;

// Chess Game Tables
export const chessGameStates = pgTable("chess_game_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().unique(),
  // Board state as JSON string (8x8 array of pieces or null)
  boardState: text("board_state").notNull(),
  whitePlayerId: varchar("white_player_id").notNull(),
  blackPlayerId: varchar("black_player_id").notNull(),
  currentTurn: text("current_turn").notNull().default("white"), // "white" or "black"
  gameStatus: text("game_status").notNull().default("in_progress"), // in_progress, checkmate, stalemate, draw, resigned
  // Castling rights
  whiteKingsideCastle: boolean("white_kingside_castle").default(true),
  whiteQueensideCastle: boolean("white_queenside_castle").default(true),
  blackKingsideCastle: boolean("black_kingside_castle").default(true),
  blackQueensideCastle: boolean("black_queenside_castle").default(true),
  // En passant target square (e.g., "e3" or null)
  enPassantTarget: text("en_passant_target"),
  // Move counters
  moveCount: integer("move_count").notNull().default(0),
  halfmoveClock: integer("halfmove_clock").notNull().default(0), // For 50-move rule
  capturedPieces: text("captured_pieces").notNull().default("[]"), // JSON array of captured pieces
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chessMoves = pgTable("chess_moves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull(),
  moveNumber: integer("move_number").notNull(),
  playerId: varchar("player_id").notNull(),
  playerColor: text("player_color").notNull(), // "white" or "black"
  fromSquare: text("from_square").notNull(), // e.g., "e2"
  toSquare: text("to_square").notNull(), // e.g., "e4"
  piece: text("piece").notNull(), // e.g., "pawn", "knight", "bishop", "rook", "queen", "king"
  capturedPiece: text("captured_piece"), // e.g., "pawn", "knight", etc., or null
  isCheck: boolean("is_check").notNull().default(false),
  isCheckmate: boolean("is_checkmate").notNull().default(false),
  isCastling: boolean("is_castling").notNull().default(false),
  isEnPassant: boolean("is_en_passant").notNull().default(false),
  promotion: text("promotion"), // e.g., "queen", "rook", "bishop", "knight"
  algebraicNotation: text("algebraic_notation").notNull(), // e.g., "e4", "Nf3", "O-O"
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChessGameStateSchema = createInsertSchema(chessGameStates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChessMoveSchema = createInsertSchema(chessMoves).omit({
  id: true,
  createdAt: true,
});

export type ChessGameState = typeof chessGameStates.$inferSelect;
export type InsertChessGameState = z.infer<typeof insertChessGameStateSchema>;
export type ChessMove = typeof chessMoves.$inferSelect;
export type InsertChessMove = z.infer<typeof insertChessMoveSchema>;

// Chess piece types
export type ChessPieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type ChessColor = 'white' | 'black';
export type ChessPiece = {
  type: ChessPieceType;
  color: ChessColor;
} | null;

// 8x8 chess board representation
export type ChessBoard = ChessPiece[][];

// Page Views - Track visits to different pages
export const pageViews = pgTable("page_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pagePath: text("page_path").notNull(), // e.g., "/", "/game-lobby"
  userId: varchar("user_id"), // Optional - tracks if user is logged in
  userAgent: text("user_agent"), // Browser info
  ipAddress: text("ip_address"), // User's IP (hashed for privacy)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPageViewSchema = createInsertSchema(pageViews).omit({
  id: true,
  createdAt: true,
});

export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = z.infer<typeof insertPageViewSchema>;

// Bug Reports - Track user-submitted bug reports
export const bugReports = pgTable("bug_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // Optional - tracks who reported it
  title: text("title").notNull(),
  description: text("description").notNull(),
  page: text("page").notNull(), // Which page the bug occurred on
  status: text("status").notNull().default("pending"), // pending, reviewing, resolved
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBugReportSchema = createInsertSchema(bugReports).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type BugReport = typeof bugReports.$inferSelect;
export type InsertBugReport = z.infer<typeof insertBugReportSchema>;
