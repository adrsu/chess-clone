import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [drawOffer, setDrawOffer] = useState<{ from: string; pending: boolean } | null>(null);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<{ result: string; reason?: string; winner?: string } | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const { socket } = useSocket();
  const navigate = useNavigate();

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

      socket.on('game-over', ({ result, winner, reason }) => {
        setGameOver(true);
        setGameResult({ result, winner, reason });
        if (reason === 'resignation') {
          setGameStatus(`Game Over: ${winner} wins by resignation`);
        } else if (reason === 'agreement') {
          setGameStatus('Game Over: Draw by agreement');
        } else if (result === 'draw') {
          setGameStatus('Game Over: Draw');
        } else {
          setGameStatus(`Game Over: ${winner} wins`);
        }
      });

      socket.on('opponent-disconnected', ({ opponentName }) => {
        setOpponentLeft(true);
        setGameStatus(`${opponentName} has left the game`);
      });

      socket.on('opponent-reconnected', ({ opponentName }) => {
        setOpponentLeft(false);
        updateGameStatus();
      });

      socket.on('move-error', ({ error }) => {
        console.error('Move error:', error);
        setGameStatus(`Move error: ${error}`);
      });

      socket.on('draw-offered', ({ from }) => {
        setDrawOffer({ from, pending: true });
      });

      socket.on('draw-accepted', () => {
        setGameStatus('Game drawn by agreement');
        setDrawOffer(null);
      });

      socket.on('draw-declined', () => {
        setDrawOffer(null);
      });
    }

    return () => {
      if (socket) {
        socket.off('game-joined');
        socket.off('move-made');
        socket.off('game-over');
        socket.off('move-error');
        socket.off('draw-offered');
        socket.off('draw-accepted');
        socket.off('draw-declined');
        socket.off('opponent-disconnected');
        socket.off('opponent-reconnected');
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

  const handleOfferDraw = () => {
    if (socket) {
      socket.emit('offer-draw', { gameId });
      setDrawOffer({ from: 'You', pending: true });
    }
  };

  const handleAcceptDraw = () => {
    if (socket) {
      socket.emit('accept-draw', { gameId });
      setDrawOffer(null);
    }
  };

  const handleDeclineDraw = () => {
    if (socket) {
      socket.emit('decline-draw', { gameId });
      setDrawOffer(null);
    }
  };

  const handleResign = () => {
    if (socket) {
      socket.emit('resign', { gameId });
      setShowResignConfirm(false);
    }
  };

  const handleReturnToLobby = () => {
    navigate('/lobby');
  };

  return (
    <div className="flex flex-col items-center relative">
      {/* Game Over Modal */}
      {gameOver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Game Over</h3>
            <p className="mb-6 text-center">
              {gameResult?.reason === 'resignation' && `${gameResult.winner} wins by resignation`}
              {gameResult?.reason === 'agreement' && 'Draw by agreement'}
              {gameResult?.result === 'draw' && gameResult.reason !== 'agreement' && 'Draw'}
              {gameResult?.result !== 'draw' && gameResult?.reason !== 'resignation' && gameResult?.reason !== 'agreement' && `${gameResult?.winner} wins`}
            </p>
            <div className="flex space-x-4">
              <button
                onClick={handleReturnToLobby}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opponent Left Modal */}
      {opponentLeft && !gameOver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Opponent Disconnected</h3>
            <p className="mb-6">Your opponent has left the game. You can wait for them to return or return to the lobby.</p>
            <div className="flex space-x-4">
              <button
                onClick={handleReturnToLobby}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draw Offer Modal */}
      {drawOffer && drawOffer.from !== 'You' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Draw Offer</h3>
            <p className="mb-6">{drawOffer.from} offers a draw</p>
            <div className="flex space-x-4">
              <button
                onClick={handleAcceptDraw}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Accept
              </button>
              <button
                onClick={handleDeclineDraw}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resign Confirmation Modal */}
      {showResignConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Resign Game</h3>
            <p className="mb-6">Are you sure you want to resign?</p>
            <div className="flex space-x-4">
              <button
                onClick={handleResign}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Yes, Resign
              </button>
              <button
                onClick={() => setShowResignConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 text-lg font-semibold">
        {gameStatus}
      </div>

      {/* Draw Offer Status */}
      {drawOffer && drawOffer.from === 'You' && (
        <div className="mb-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800">
          Draw offer sent. Waiting for opponent's response...
        </div>
      )}

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
          onClick={handleOfferDraw}
          disabled={drawOffer !== null}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {drawOffer?.from === 'You' ? 'Draw Offered' : 'Offer Draw'}
        </button>
        <button
          onClick={() => setShowResignConfirm(true)}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Resign
        </button>
      </div>
    </div>
  );
};
