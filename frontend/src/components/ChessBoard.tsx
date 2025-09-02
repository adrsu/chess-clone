import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useSocket } from '../contexts/SocketContext';

interface ChessBoardProps {
  gameId: number;
  playerColor?: 'white' | 'black';
}

export const ChessBoard: React.FC<ChessBoardProps> = ({ gameId, playerColor: initialPlayerColor }) => {
  const [chess] = useState(new Chess());
  const [position, setPosition] = useState(chess.fen());
  const [gameStatus, setGameStatus] = useState('Connecting to game...');
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>(initialPlayerColor || 'white');
  const [gameJoined, setGameJoined] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    if (socket) {
      socket.emit('join-game', { gameId });

      socket.on('game-joined', ({ gameId: joinedGameId, playerColor: assignedColor }) => {
        console.log('Joined game:', joinedGameId, 'as', assignedColor);
        setPlayerColor(assignedColor);
        setGameJoined(true);
        updateGameStatus();
      });

      socket.on('move-made', ({ move, gameState }) => {
        chess.load(gameState.fen);
        setPosition(gameState.fen);
        updateGameStatus();
      });

      socket.on('game-over', ({ result, winner }) => {
        setGameStatus(`Game Over: ${result} - ${winner} wins`);
      });

      socket.on('move-error', ({ error }) => {
        console.error('Move error:', error);
        setGameStatus(`Move error: ${error}`);
      });
    }

    return () => {
      if (socket) {
        socket.off('game-joined');
        socket.off('move-made');
        socket.off('game-over');
        socket.off('move-error');
      }
    };
  }, [socket, gameId, chess]);

  const updateGameStatus = () => {
    if (chess.isGameOver()) {
      if (chess.isCheckmate()) {
        setGameStatus(`Checkmate - ${chess.turn() === 'w' ? 'Black' : 'White'} wins`);
      } else if (chess.isDraw()) {
        setGameStatus('Draw');
      }
    } else if (chess.inCheck()) {
      setGameStatus(`${chess.turn() === 'w' ? 'White' : 'Black'} is in check`);
    } else {
      setGameStatus(`${chess.turn() === 'w' ? 'White' : 'Black'} to move`);
    }
  };

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    // Check if it's the player's turn
    const currentTurn = chess.turn();
    const isPlayerTurn = (currentTurn === 'w' && playerColor === 'white') || 
                        (currentTurn === 'b' && playerColor === 'black');
    
    if (!isPlayerTurn) {
      setGameStatus(`Not your turn! It's ${currentTurn === 'w' ? 'White' : 'Black'}'s turn`);
      return false;
    }

    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // Always promote to queen for simplicity
      });

      if (move === null) return false;

      // Send move to server first, don't update local state yet
      // The server will send back the confirmed move
      if (socket) {
        socket.emit('make-move', {
          gameId,
          move: move.san
        });
      }

      // Revert the local move, wait for server confirmation
      chess.undo();
      return true;
    } catch (error) {
      return false;
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 text-lg font-semibold">
        {gameStatus}
      </div>
      <div className="chess-board">
        <Chessboard
          position={position}
          onPieceDrop={onDrop}
          boardOrientation={playerColor}
          arePiecesDraggable={true}
          boardWidth={600}
        />
      </div>
      <div className="mt-4 flex space-x-4">
        <button
          onClick={() => socket?.emit('offer-draw', { gameId })}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Offer Draw
        </button>
        <button
          onClick={() => socket?.emit('resign', { gameId })}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Resign
        </button>
      </div>
    </div>
  );
};
