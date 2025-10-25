import { useState, useEffect } from "react";
import { doc, collection, query, where, orderBy, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ChessGameState } from "./use-chess";

export function useChessGameStateRealtime(gameId: string) {
  const [data, setData] = useState<ChessGameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!gameId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    let unsubscribeGame: Unsubscribe | null = null;
    let unsubscribeChessState: Unsubscribe | null = null;
    let unsubscribeParticipants: Unsubscribe | null = null;
    let unsubscribeMoves: Unsubscribe | null = null;

    const setupListeners = async () => {
      unsubscribeGame = onSnapshot(
        doc(db, "games", gameId),
        (gameDoc) => {
          if (!gameDoc.exists()) {
            setError(new Error("Game not found"));
            setIsLoading(false);
            return;
          }

          const gameData = { id: gameDoc.id, ...gameDoc.data() } as any;

          if (unsubscribeChessState) {
            unsubscribeChessState();
          }

          unsubscribeChessState = onSnapshot(
            doc(db, "chess_game_states", gameId),
            (chessStateDoc) => {
              if (!chessStateDoc.exists()) {
                setError(new Error("Chess state not found"));
                setIsLoading(false);
                return;
              }

              const chessStateData = chessStateDoc.data();

              if (unsubscribeParticipants) {
                unsubscribeParticipants();
              }

              unsubscribeParticipants = onSnapshot(
                query(collection(db, "game_participants"), where("gameId", "==", gameId)),
                async (participantsSnapshot) => {
                  const participants = participantsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                  }));

                  const userIds = participants.map((p: any) => p.userId);
                  const playersData = await Promise.all(
                    userIds.map(async (userId: string) => {
                      try {
                        const userDocRef = doc(db, "users", userId);
                        return new Promise<any>((resolve) => {
                          const unsub = onSnapshot(userDocRef, (snap) => {
                            resolve(snap.exists() ? { id: snap.id, ...snap.data() } : null);
                            unsub();
                          });
                        });
                      } catch {
                        return null;
                      }
                    })
                  );

                  const players = playersData
                    .filter((p): p is any => p !== null)
                    .map((user: any) => ({
                      userId: user.id,
                      username: user.username,
                      profileImageUrl: user.profileImageUrl,
                      color: (user.id === chessStateData.whitePlayerId ? 'white' : 'black') as 'white' | 'black'
                    }));

                  if (unsubscribeMoves) {
                    unsubscribeMoves();
                  }

                  unsubscribeMoves = onSnapshot(
                    query(
                      collection(db, "chess_moves"),
                      where("gameId", "==", gameId),
                      orderBy("moveNumber", "asc")
                    ),
                    (movesSnapshot) => {
                      const moves = movesSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
                      })) as any;

                      let boardState;
                      try {
                        boardState = typeof chessStateData.boardState === 'string' 
                          ? JSON.parse(chessStateData.boardState) 
                          : chessStateData.boardState;
                      } catch {
                        boardState = chessStateData.boardState;
                      }

                      let capturedPieces;
                      try {
                        capturedPieces = typeof chessStateData.capturedPieces === 'string'
                          ? JSON.parse(chessStateData.capturedPieces)
                          : chessStateData.capturedPieces || [];
                      } catch {
                        capturedPieces = [];
                      }

                      const combinedData: ChessGameState = {
                        game: {
                          id: gameData.id,
                          name: gameData.name,
                          gameType: gameData.gameType,
                          entryFee: gameData.entryFee,
                          maxPlayers: gameData.maxPlayers,
                          currentPlayers: gameData.currentPlayers,
                          prizeAmount: gameData.prizeAmount,
                          status: gameData.status,
                          winnerId: gameData.winnerId || null,
                          createdAt: gameData.createdAt?.toDate?.()?.toISOString() || null,
                          startedAt: gameData.startedAt?.toDate?.()?.toISOString() || null,
                          completedAt: gameData.completedAt?.toDate?.()?.toISOString() || null,
                        },
                        chessState: {
                          id: chessStateDoc.id,
                          gameId: chessStateData.gameId,
                          boardState,
                          currentTurn: chessStateData.currentTurn,
                          whitePlayerId: chessStateData.whitePlayerId,
                          blackPlayerId: chessStateData.blackPlayerId,
                          capturedPieces,
                          isCheck: chessStateData.isCheck || false,
                          isCheckmate: chessStateData.isCheckmate || false,
                          isStalemate: chessStateData.isStalemate || false,
                          winner: chessStateData.winner || null,
                          enPassantTarget: chessStateData.enPassantTarget || null,
                          whiteKingsideCastle: chessStateData.whiteKingsideCastle ?? true,
                          whiteQueensideCastle: chessStateData.whiteQueensideCastle ?? true,
                          blackKingsideCastle: chessStateData.blackKingsideCastle ?? true,
                          blackQueensideCastle: chessStateData.blackQueensideCastle ?? true,
                          moveCount: chessStateData.moveCount || 0,
                        },
                        players,
                        moves
                      };

                      setData(combinedData);
                      setIsLoading(false);
                      setError(null);
                    },
                    (err) => {
                      console.error("Error listening to moves:", err);
                      setError(err as Error);
                      setIsLoading(false);
                    }
                  );
                },
                (err) => {
                  console.error("Error listening to participants:", err);
                  setError(err as Error);
                  setIsLoading(false);
                }
              );
            },
            (err) => {
              console.error("Error listening to chess state:", err);
              setError(err as Error);
              setIsLoading(false);
            }
          );
        },
        (err) => {
          console.error("Error listening to game:", err);
          setError(err as Error);
          setIsLoading(false);
        }
      );
    };

    setupListeners();

    return () => {
      if (unsubscribeGame) unsubscribeGame();
      if (unsubscribeChessState) unsubscribeChessState();
      if (unsubscribeParticipants) unsubscribeParticipants();
      if (unsubscribeMoves) unsubscribeMoves();
    };
  }, [gameId]);

  return { data, isLoading, error };
}
