import { ChessBoard, ChessPiece, ChessPieceType, ChessColor, ChessGameState } from "@shared/schema";

export interface ChessPosition {
  row: number;
  col: number;
}

export interface ChessMove {
  from: ChessPosition;
  to: ChessPosition;
  promotion?: ChessPieceType;
}

export interface MoveResult {
  valid: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  capturedPiece?: ChessPiece;
  isCastling?: boolean;
  isEnPassant?: boolean;
  error?: string;
}

export function initializeChessBoard(): ChessBoard {
  const board: ChessBoard = Array(8).fill(null).map(() => Array(8).fill(null));
  
  const backRank: ChessPieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  
  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: backRank[col], color: 'black' };
    board[1][col] = { type: 'pawn', color: 'black' };
    board[6][col] = { type: 'pawn', color: 'white' };
    board[7][col] = { type: backRank[col], color: 'white' };
  }
  
  return board;
}

export function squareToPosition(square: string): ChessPosition {
  const col = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = 8 - parseInt(square[1]);
  return { row, col };
}

export function positionToSquare(pos: ChessPosition): string {
  const col = String.fromCharCode('a'.charCodeAt(0) + pos.col);
  const row = (8 - pos.row).toString();
  return col + row;
}

function isValidPosition(pos: ChessPosition): boolean {
  return pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8;
}

export function validateMove(
  board: ChessBoard,
  move: ChessMove,
  currentTurn: ChessColor,
  castlingRights: {
    whiteKingside: boolean;
    whiteQueenside: boolean;
    blackKingside: boolean;
    blackQueenside: boolean;
  },
  enPassantTarget: string | null
): MoveResult {
  const { from, to, promotion } = move;
  
  if (!isValidPosition(from) || !isValidPosition(to)) {
    return { valid: false, isCheck: false, isCheckmate: false, isStalemate: false, error: "Invalid position" };
  }
  
  const piece = board[from.row][from.col];
  if (!piece) {
    return { valid: false, isCheck: false, isCheckmate: false, isStalemate: false, error: "No piece at source position" };
  }
  
  if (piece.color !== currentTurn) {
    return { valid: false, isCheck: false, isCheckmate: false, isStalemate: false, error: "Not your piece" };
  }
  
  const targetPiece = board[to.row][to.col];
  if (targetPiece && targetPiece.color === piece.color) {
    return { valid: false, isCheck: false, isCheckmate: false, isStalemate: false, error: "Cannot capture your own piece" };
  }
  
  const isCastling = piece.type === 'king' && Math.abs(to.col - from.col) === 2;
  const isEnPassant = !!(piece.type === 'pawn' && to.col !== from.col && !targetPiece && enPassantTarget && positionToSquare(to) === enPassantTarget);
  
  if (isCastling) {
    const canCastle = validateCastling(board, from, to, piece.color, castlingRights);
    if (!canCastle) {
      return { valid: false, isCheck: false, isCheckmate: false, isStalemate: false, error: "Cannot castle" };
    }
  } else {
    const basicValid = isValidPieceMove(board, piece, from, to, enPassantTarget);
    if (!basicValid) {
      return { valid: false, isCheck: false, isCheckmate: false, isStalemate: false, error: "Invalid move for this piece" };
    }
  }
  
  if (piece.type === 'pawn' && (to.row === 0 || to.row === 7)) {
    if (!promotion || !['queen', 'rook', 'bishop', 'knight'].includes(promotion)) {
      return { valid: false, isCheck: false, isCheckmate: false, isStalemate: false, error: "Pawn promotion required" };
    }
  }
  
  const newBoard = executeMoveOnBoard(board, from, to, piece, promotion, isEnPassant, isCastling);
  if (isKingInCheck(newBoard, currentTurn)) {
    return { valid: false, isCheck: false, isCheckmate: false, isStalemate: false, error: "Move puts king in check" };
  }
  
  const opponentColor = currentTurn === 'white' ? 'black' : 'white';
  const isCheck = isKingInCheck(newBoard, opponentColor);
  
  const hasLegalMoves = existsLegalMove(newBoard, opponentColor, castlingRights, null);
  const isCheckmate = isCheck && !hasLegalMoves;
  const isStalemate = !isCheck && !hasLegalMoves;
  
  return {
    valid: true,
    isCheck,
    isCheckmate,
    isStalemate,
    capturedPiece: isEnPassant ? { type: 'pawn', color: opponentColor } : (targetPiece || undefined),
    isCastling,
    isEnPassant
  };
}

function validateCastling(
  board: ChessBoard,
  from: ChessPosition,
  to: ChessPosition,
  color: ChessColor,
  castlingRights: {
    whiteKingside: boolean;
    whiteQueenside: boolean;
    blackKingside: boolean;
    blackQueenside: boolean;
  }
): boolean {
  const isKingside = to.col > from.col;
  const row = color === 'white' ? 7 : 0;
  
  if (from.row !== row || from.col !== 4) return false;
  
  if (isKingside) {
    if (color === 'white' && !castlingRights.whiteKingside) return false;
    if (color === 'black' && !castlingRights.blackKingside) return false;
    
    if (board[row][5] || board[row][6]) return false;
    
    if (isKingInCheck(board, color)) return false;
    if (isSquareAttacked(board, { row, col: 5 }, color)) return false;
    if (isSquareAttacked(board, { row, col: 6 }, color)) return false;
  } else {
    if (color === 'white' && !castlingRights.whiteQueenside) return false;
    if (color === 'black' && !castlingRights.blackQueenside) return false;
    
    if (board[row][1] || board[row][2] || board[row][3]) return false;
    
    if (isKingInCheck(board, color)) return false;
    if (isSquareAttacked(board, { row, col: 2 }, color)) return false;
    if (isSquareAttacked(board, { row, col: 3 }, color)) return false;
  }
  
  return true;
}

function executeMoveOnBoard(
  board: ChessBoard,
  from: ChessPosition,
  to: ChessPosition,
  piece: ChessPiece,
  promotion: ChessPieceType | undefined,
  isEnPassant: boolean,
  isCastling: boolean
): ChessBoard {
  const newBoard: ChessBoard = board.map(row => [...row]);
  
  if (isCastling) {
    newBoard[to.row][to.col] = newBoard[from.row][from.col];
    newBoard[from.row][from.col] = null;
    
    const isKingside = to.col > from.col;
    if (isKingside) {
      newBoard[from.row][5] = newBoard[from.row][7];
      newBoard[from.row][7] = null;
    } else {
      newBoard[from.row][3] = newBoard[from.row][0];
      newBoard[from.row][0] = null;
    }
  } else if (isEnPassant) {
    newBoard[to.row][to.col] = newBoard[from.row][from.col];
    newBoard[from.row][from.col] = null;
    newBoard[from.row][to.col] = null;
  } else {
    if (promotion && piece && piece.type === 'pawn') {
      newBoard[to.row][to.col] = { type: promotion, color: piece.color };
    } else {
      newBoard[to.row][to.col] = newBoard[from.row][from.col];
    }
    newBoard[from.row][from.col] = null;
  }
  
  return newBoard;
}

function existsLegalMove(
  board: ChessBoard,
  color: ChessColor,
  castlingRights: {
    whiteKingside: boolean;
    whiteQueenside: boolean;
    blackKingside: boolean;
    blackQueenside: boolean;
  },
  enPassantTarget: string | null
): boolean {
  for (let fromRow = 0; fromRow < 8; fromRow++) {
    for (let fromCol = 0; fromCol < 8; fromCol++) {
      const piece = board[fromRow][fromCol];
      if (piece && piece.color === color) {
        for (let toRow = 0; toRow < 8; toRow++) {
          for (let toCol = 0; toCol < 8; toCol++) {
            const from = { row: fromRow, col: fromCol };
            const to = { row: toRow, col: toCol };
            
            if (isPseudoLegalMove(board, piece, from, to, enPassantTarget)) {
              const newBoard = executeMoveOnBoard(board, from, to, piece, undefined, false, false);
              if (!isKingInCheck(newBoard, color)) {
                return true;
              }
            }
          }
        }
      }
    }
  }
  return false;
}

function isPseudoLegalMove(
  board: ChessBoard,
  piece: ChessPiece,
  from: ChessPosition,
  to: ChessPosition,
  enPassantTarget: string | null
): boolean {
  if (!piece) return false;
  if (from.row === to.row && from.col === to.col) return false;
  
  const targetPiece = board[to.row][to.col];
  if (targetPiece && targetPiece.color === piece.color) return false;
  
  return isValidPieceMove(board, piece, from, to, enPassantTarget);
}

function isValidPieceMove(
  board: ChessBoard,
  piece: ChessPiece,
  from: ChessPosition,
  to: ChessPosition,
  enPassantTarget: string | null
): boolean {
  if (!piece) return false;
  
  const rowDiff = to.row - from.row;
  const colDiff = to.col - from.col;
  
  switch (piece.type) {
    case 'pawn':
      return isValidPawnMove(board, piece, from, to, enPassantTarget);
    case 'knight':
      return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) ||
             (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
    case 'bishop':
      return isValidDiagonalMove(board, from, to);
    case 'rook':
      return isValidStraightMove(board, from, to);
    case 'queen':
      return isValidStraightMove(board, from, to) || isValidDiagonalMove(board, from, to);
    case 'king':
      return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
    default:
      return false;
  }
}

function isValidPawnMove(
  board: ChessBoard,
  piece: ChessPiece,
  from: ChessPosition,
  to: ChessPosition,
  enPassantTarget: string | null
): boolean {
  if (!piece) return false;
  
  const direction = piece.color === 'white' ? -1 : 1;
  const startRow = piece.color === 'white' ? 6 : 1;
  const rowDiff = to.row - from.row;
  const colDiff = Math.abs(to.col - from.col);
  
  if (rowDiff === direction && colDiff === 0) {
    return !board[to.row][to.col];
  }
  
  if (rowDiff === 2 * direction && colDiff === 0 && from.row === startRow) {
    const middleRow = from.row + direction;
    return !board[middleRow][from.col] && !board[to.row][to.col];
  }
  
  if (rowDiff === direction && colDiff === 1) {
    const targetPiece = board[to.row][to.col];
    if (targetPiece && targetPiece.color !== piece.color) {
      return true;
    }
    if (enPassantTarget && positionToSquare(to) === enPassantTarget) {
      return true;
    }
  }
  
  return false;
}

function isValidStraightMove(board: ChessBoard, from: ChessPosition, to: ChessPosition): boolean {
  if (from.row !== to.row && from.col !== to.col) {
    return false;
  }
  
  const rowStep = from.row === to.row ? 0 : (to.row > from.row ? 1 : -1);
  const colStep = from.col === to.col ? 0 : (to.col > from.col ? 1 : -1);
  
  let row = from.row + rowStep;
  let col = from.col + colStep;
  
  while (row !== to.row || col !== to.col) {
    if (board[row][col]) {
      return false;
    }
    row += rowStep;
    col += colStep;
  }
  
  return true;
}

function isValidDiagonalMove(board: ChessBoard, from: ChessPosition, to: ChessPosition): boolean {
  if (Math.abs(to.row - from.row) !== Math.abs(to.col - from.col)) {
    return false;
  }
  
  const rowStep = to.row > from.row ? 1 : -1;
  const colStep = to.col > from.col ? 1 : -1;
  
  let row = from.row + rowStep;
  let col = from.col + colStep;
  
  while (row !== to.row || col !== to.col) {
    if (board[row][col]) {
      return false;
    }
    row += rowStep;
    col += colStep;
  }
  
  return true;
}

function findKing(board: ChessBoard, color: ChessColor): ChessPosition | null {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'king' && piece.color === color) {
        return { row, col };
      }
    }
  }
  return null;
}

function isSquareAttacked(board: ChessBoard, square: ChessPosition, defendingColor: ChessColor): boolean {
  const opponentColor = defendingColor === 'white' ? 'black' : 'white';
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === opponentColor) {
        if (isValidPieceMove(board, piece, { row, col }, square, null)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

function isKingInCheck(board: ChessBoard, kingColor: ChessColor): boolean {
  const kingPos = findKing(board, kingColor);
  if (!kingPos) return false;
  
  return isSquareAttacked(board, kingPos, kingColor);
}

export function getMoveNotation(
  board: ChessBoard,
  from: ChessPosition,
  to: ChessPosition,
  isCapture: boolean,
  isCheck: boolean,
  isCheckmate: boolean,
  isCastling: boolean,
  promotion?: ChessPieceType
): string {
  if (isCastling) {
    const isKingside = to.col > from.col;
    return isKingside ? 'O-O' : 'O-O-O';
  }
  
  const piece = board[from.row][from.col];
  if (!piece) return '';
  
  const fromSquare = positionToSquare(from);
  const toSquare = positionToSquare(to);
  
  if (piece.type === 'pawn') {
    let notation = '';
    if (isCapture) {
      notation = fromSquare[0] + 'x' + toSquare;
    } else {
      notation = toSquare;
    }
    if (promotion) {
      notation += '=' + (promotion === 'knight' ? 'N' : promotion[0].toUpperCase());
    }
    return notation + (isCheckmate ? '#' : isCheck ? '+' : '');
  }
  
  const pieceSymbol = piece.type === 'knight' ? 'N' : piece.type[0].toUpperCase();
  const captureSymbol = isCapture ? 'x' : '';
  const notation = pieceSymbol + captureSymbol + toSquare;
  
  return notation + (isCheckmate ? '#' : isCheck ? '+' : '');
}

export function getEnPassantTarget(
  from: ChessPosition,
  to: ChessPosition,
  piece: ChessPiece
): string | null {
  if (!piece || piece.type !== 'pawn') return null;
  if (Math.abs(to.row - from.row) !== 2) return null;
  
  const middleRow = (from.row + to.row) / 2;
  return positionToSquare({ row: middleRow, col: from.col });
}

export function updateCastlingRights(
  from: ChessPosition,
  piece: ChessPiece,
  castlingRights: {
    whiteKingside: boolean;
    whiteQueenside: boolean;
    blackKingside: boolean;
    blackQueenside: boolean;
  }
): {
  whiteKingside: boolean;
  whiteQueenside: boolean;
  blackKingside: boolean;
  blackQueenside: boolean;
} {
  const newRights = { ...castlingRights };
  
  if (!piece) return newRights;
  
  if (piece.type === 'king') {
    if (piece.color === 'white') {
      newRights.whiteKingside = false;
      newRights.whiteQueenside = false;
    } else {
      newRights.blackKingside = false;
      newRights.blackQueenside = false;
    }
  }
  
  if (piece.type === 'rook') {
    if (piece.color === 'white' && from.row === 7) {
      if (from.col === 0) newRights.whiteQueenside = false;
      if (from.col === 7) newRights.whiteKingside = false;
    }
    if (piece.color === 'black' && from.row === 0) {
      if (from.col === 0) newRights.blackQueenside = false;
      if (from.col === 7) newRights.blackKingside = false;
    }
  }
  
  return newRights;
}
