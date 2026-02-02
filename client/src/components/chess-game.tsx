import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useChessGameState, useMakeChessMove, useResignChess, useValidMoves } from "@/hooks/use-chess";
import { useWhopUser } from "@/hooks/use-whop-user";
import { useToast } from "@/hooks/use-toast";
import { Users, Crown, Loader2, Flag, ArrowLeft, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChessGameProps {
  gameId: string;
  onBack?: () => void;
}

const pieceSymbols: Record<string, string> = {
  'white-king': '♔',
  'white-queen': '♕',
  'white-rook': '♖',
  'white-bishop': '♗',
  'white-knight': '♘',
  'white-pawn': '♙',
  'black-king': '♚',
  'black-queen': '♛',
  'black-rook': '♜',
  'black-bishop': '♝',
  'black-knight': '♞',
  'black-pawn': '♟',
};

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

export default function ChessGame({ gameId, onBack }: ChessGameProps) {
  const [, setLocation] = useLocation();
  const { user: whopUser, isLoading: whopUserLoading, isInWhopIframe } = useWhopUser();
  const { data: gameState, isLoading } = useChessGameState(gameId);
  const makeMove = useMakeChessMove(gameId);
  const resign = useResignChess(gameId);
  const { toast } = useToast();
  
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [promotionDialog, setPromotionDialog] = useState<{ from: string; to: string } | null>(null);
  const { data: validMovesData } = useValidMoves(gameId, selectedSquare);
  const validMoves = validMovesData?.validMoves || [];

  useEffect(() => {
    if (gameState?.game.status === "completed") {
      setLocation(`/results/${gameId}`);
    }
  }, [gameState?.game.status, gameId, setLocation]);

  const handleSquareClick = (file: string, rank: string) => {
    const square = `${file}${rank}`;
    
    if (!gameState || gameState.game.status !== "running") return;
    
    const myPlayer = gameState.players.find(p => p.userId === whopUser?.id);
    if (!myPlayer || gameState.chessState.currentTurn !== myPlayer.color) return;

    if (selectedSquare) {
      const fromRow = 8 - parseInt(selectedSquare[1]);
      const fromCol = selectedSquare.charCodeAt(0) - 'a'.charCodeAt(0);
      const piece = gameState.chessState.boardState[fromRow][fromCol];
      
      if (piece?.type === 'pawn') {
        const toRow = 8 - parseInt(rank);
        if ((piece.color === 'white' && toRow === 0) || (piece.color === 'black' && toRow === 7)) {
          setPromotionDialog({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          return;
        }
      }
      
      makeMove.mutate({ from: selectedSquare, to: square }, {
        onError: (error: any) => {
          toast({
            title: "Invalid Move",
            description: error.message || "That move is not allowed",
            variant: "destructive",
          });
        },
      });
      setSelectedSquare(null);
    } else {
      const row = 8 - parseInt(rank);
      const col = file.charCodeAt(0) - 'a'.charCodeAt(0);
      const piece = gameState.chessState.boardState[row][col];
      
      if (piece && piece.color === myPlayer.color) {
        setSelectedSquare(square);
      }
    }
  };

  const handlePromotion = (pieceType: 'queen' | 'rook' | 'bishop' | 'knight') => {
    if (!promotionDialog) return;
    
    makeMove.mutate({ 
      from: promotionDialog.from, 
      to: promotionDialog.to, 
      promotion: pieceType 
    }, {
      onError: (error: any) => {
        toast({
          title: "Invalid Move",
          description: error.message || "That move is not allowed",
          variant: "destructive",
        });
      },
    });
    setPromotionDialog(null);
  };

  const handleResign = () => {
    resign.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Game Resigned",
          description: "You have resigned from the game.",
        });
      },
    });
  };

  // Critical: Wait for Whop user to load when in Whop iframe
  // This prevents blank page issues when auth is still loading
  if (whopUserLoading || isLoading || !gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-slate-400">
            {whopUserLoading ? "Authenticating..." : "Loading chess game..."}
          </p>
        </div>
      </div>
    );
  }
  
  // Critical: If in Whop iframe but no user loaded, show authentication error
  if (isInWhopIframe && !whopUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-red-700 max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl text-red-400">⚠️ Authentication Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-slate-300 mb-4">
              Unable to authenticate your Whop account. Please refresh the page or contact support if this persists.
            </p>
            <Button 
              className="w-full" 
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const myPlayer = gameState.players.find(p => p.userId === whopUser?.id);
  const opponentPlayer = gameState.players.find(p => p.userId !== whopUser?.id);
  const isMyTurn = myPlayer && gameState.chessState.currentTurn === myPlayer.color;
  
  const displayFiles = myPlayer?.color === 'black' ? [...files].reverse() : files;
  const displayRanks = myPlayer?.color === 'black' ? [...ranks].reverse() : ranks;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={onBack || (() => setLocation("/"))}
            variant="ghost"
            className="text-white hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Lobby
          </Button>
          <Badge variant={gameState.game.status === "running" ? "default" : "secondary"}>
            {gameState.game.status === "running" ? "Game In Progress" : gameState.game.status}
          </Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={opponentPlayer?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e"}
                      alt={opponentPlayer?.username}
                      className="w-10 h-10 rounded-full border-2 border-slate-600"
                    />
                    <div>
                      <p className="text-white font-semibold">{opponentPlayer?.username || "Opponent"}</p>
                      <p className="text-xs text-slate-400">{opponentPlayer?.color === 'white' ? '♔ White' : '♚ Black'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {gameState.chessState.capturedPieces
                      .filter(p => p.color === myPlayer?.color)
                      .map((piece, idx) => (
                        <span key={idx} className="text-2xl opacity-50">
                          {pieceSymbols[`${piece.color}-${piece.type}`]}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-100 to-amber-200 p-4 rounded-lg shadow-2xl">
                  <div className="grid grid-cols-8 gap-0">
                    {displayRanks.map((rank, rankIdx) => (
                      displayFiles.map((file, fileIdx) => {
                        const isLight = (rankIdx + fileIdx) % 2 === 0;
                        const square = `${file}${rank}`;
                        const row = 8 - parseInt(rank);
                        const col = file.charCodeAt(0) - 'a'.charCodeAt(0);
                        const piece = gameState.chessState.boardState[row][col];
                        const isSelected = selectedSquare === square;
                        const isValidMove = validMoves.includes(square);
                        
                        return (
                          <button
                            key={square}
                            onClick={() => handleSquareClick(file, rank)}
                            disabled={!myPlayer || gameState.game.status !== "running"}
                            className={cn(
                              "aspect-square flex items-center justify-center text-5xl transition-all relative",
                              isLight ? "bg-amber-100" : "bg-amber-700",
                              isSelected && "ring-4 ring-blue-500 ring-inset",
                              isMyTurn && "hover:opacity-80 cursor-pointer",
                              !isMyTurn && "cursor-not-allowed"
                            )}
                          >
                            {isValidMove && !piece && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                <div className="w-5 h-5 bg-green-500 rounded-full opacity-70" />
                              </div>
                            )}
                            {isValidMove && piece && (
                              <div className="absolute inset-0 pointer-events-none z-10">
                                <div className="absolute inset-1 bg-green-500/50 rounded-full border-4 border-green-500" />
                              </div>
                            )}
                            {piece && (
                              <span className={cn(
                                "relative z-20",
                                piece.color === 'white' ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-black drop-shadow-[0_2px_2px_rgba(255,255,255,0.3)]'
                              )}>
                                {pieceSymbols[`${piece.color}-${piece.type}`]}
                              </span>
                            )}
                            {fileIdx === 0 && (
                              <span className="absolute left-1 top-1 text-xs font-semibold" style={{ color: isLight ? '#78350f' : '#fef3c7' }}>
                                {rank}
                              </span>
                            )}
                            {rankIdx === 7 && (
                              <span className="absolute right-1 bottom-1 text-xs font-semibold" style={{ color: isLight ? '#78350f' : '#fef3c7' }}>
                                {file}
                              </span>
                            )}
                          </button>
                        );
                      })
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={myPlayer?.profileImageUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde"}
                      alt={myPlayer?.username}
                      className="w-10 h-10 rounded-full border-2 border-violet-500"
                    />
                    <div>
                      <p className="text-white font-semibold">{myPlayer?.username || whopUser?.username || "You"}</p>
                      <p className="text-xs text-slate-400">{myPlayer?.color === 'white' ? '♔ White' : '♚ Black'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {gameState.chessState.capturedPieces
                      .filter(p => p.color === opponentPlayer?.color)
                      .map((piece, idx) => (
                        <span key={idx} className="text-2xl opacity-50">
                          {pieceSymbols[`${piece.color}-${piece.type}`]}
                        </span>
                      ))}
                  </div>
                </div>

                {gameState.chessState.isCheck && !gameState.chessState.isCheckmate && (
                  <div className="mt-4 bg-red-500/20 border border-red-500 rounded-lg p-3 text-center">
                    <p className="text-red-400 font-bold">Check!</p>
                  </div>
                )}

                {isMyTurn && (
                  <div className="mt-4 bg-green-500/20 border border-green-500 rounded-lg p-3 text-center">
                    <p className="text-green-400 font-bold">Your Turn</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  Game Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Entry Fee:</span>
                  <span className="text-white font-semibold">${parseFloat(gameState.game.entryFee).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Prize Pool:</span>
                  <span className="text-green-400 font-semibold">${parseFloat(gameState.game.prizeAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Moves:</span>
                  <span className="text-white font-semibold">{gameState.chessState.moveCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Turn:</span>
                  <span className="text-white font-semibold">
                    {gameState.chessState.currentTurn === 'white' ? '♔ White' : '♚ Black'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-sm">Move History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {gameState.moves.length === 0 ? (
                    <p className="text-slate-500 text-sm">No moves yet</p>
                  ) : (
                    gameState.moves.map((move, idx) => (
                      <div key={move.id} className="text-sm flex items-center gap-2 text-slate-300">
                        <span className="text-slate-500">{idx + 1}.</span>
                        <span>{move.notation}</span>
                        {move.isCheck && <span className="text-red-400">✓</span>}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {gameState.game.status === "running" && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Flag className="w-4 h-4 mr-2" />
                    Resign
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Resign Game?</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Are you sure you want to resign? Your opponent will win the game.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" className="border-slate-600 text-white">
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleResign} disabled={resign.isPending}>
                      {resign.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Resign"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!promotionDialog} onOpenChange={(open) => !open && setPromotionDialog(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Promote Pawn</DialogTitle>
            <DialogDescription className="text-slate-400">
              Choose which piece to promote your pawn to:
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-4 py-4">
            {(['queen', 'rook', 'bishop', 'knight'] as const).map((piece) => {
              const color = myPlayer?.color || 'white';
              return (
                <button
                  key={piece}
                  onClick={() => handlePromotion(piece)}
                  className="aspect-square bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-6xl transition-colors border-2 border-slate-600 hover:border-violet-500"
                >
                  {pieceSymbols[`${color}-${piece}`]}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
