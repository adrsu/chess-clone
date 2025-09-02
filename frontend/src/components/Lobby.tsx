import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

interface QueueStatus {
  playersInQueue: number;
  estimatedWaitTime: number;
}

export const Lobby: React.FC = () => {
  const [inQueue, setInQueue] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({ playersInQueue: 0, estimatedWaitTime: 0 });
  const [searching, setSearching] = useState(false);
  const [waitTime, setWaitTime] = useState(0);
  const [queueStartTime, setQueueStartTime] = useState<Date | null>(null);
  const { state: authState, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;

    // Socket event listeners
    socket.on('matchmaking-joined', (status: QueueStatus) => {
      setInQueue(true);
      setSearching(true);
      setQueueStatus(status);
      setQueueStartTime(new Date());
      setWaitTime(0);
    });

    socket.on('matchmaking-left', () => {
      setInQueue(false);
      setSearching(false);
      setQueueStartTime(null);
      setWaitTime(0);
    });

    socket.on('matchmaking-error', (data: { error: string }) => {
      console.error('Matchmaking error:', data.error);
      setInQueue(false);
      setSearching(false);
    });

    socket.on('match-found', (data: { gameId: number; opponent: { username: string; rating: number }; playerColor: string }) => {
      setInQueue(false);
      setSearching(false);
      setQueueStartTime(null);
      console.log('Match found!', data);
      navigate(`/game/${data.gameId}`);
    });

    socket.on('queue-status', (status: QueueStatus) => {
      setQueueStatus(status);
    });

    socket.on('queue-status-update', (status: QueueStatus) => {
      setQueueStatus(status);
    });

    // Cleanup listeners
    return () => {
      socket.off('matchmaking-joined');
      socket.off('matchmaking-left');
      socket.off('matchmaking-error');
      socket.off('match-found');
      socket.off('queue-status');
      socket.off('queue-status-update');
    };
  }, [socket, navigate]);

  // Timer for tracking actual wait time
  useEffect(() => {
    if (!inQueue || !queueStartTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - queueStartTime.getTime()) / 1000);
      setWaitTime(elapsedSeconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [inQueue, queueStartTime]);

  const handleJoinQueue = () => {
    if (!socket) return;
    socket.emit('join-matchmaking');
  };

  const handleLeaveQueue = () => {
    if (!socket) return;
    socket.emit('leave-matchmaking');
  };

  const handleLogout = () => {
    if (socket && inQueue) {
      socket.emit('leave-matchmaking');
    }
    logout();
    navigate('/login');
  };

  if (!authState.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome, {authState.user.username}!
              </h1>
              <p className="text-gray-600 mt-1">
                Rating: {authState.user.rating} • Ready to play chess?
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Queue Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Queue Status</h2>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{queueStatus.playersInQueue}</p>
              <p className="text-gray-600">Players in Queue</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {Math.floor(waitTime / 60)}:{(waitTime % 60).toString().padStart(2, '0')}
              </p>
              <p className="text-gray-600">{inQueue ? 'Current Wait Time' : 'Wait Time'}</p>
            </div>
          </div>
        </div>

        {/* Matchmaking Controls */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {!inQueue ? (
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Find a Match</h2>
              <p className="text-gray-600 mb-6">
                Click below to join the matchmaking queue and get paired with another player
              </p>
              <button
                onClick={handleJoinQueue}
                className="w-full max-w-md px-8 py-4 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Find Match
              </button>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Searching for Opponent</h2>
              {searching && (
                <div className="flex justify-center mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
              <p className="text-gray-600 mb-6">
                Looking for a suitable opponent... Please wait.
              </p>
              <button
                onClick={handleLeaveQueue}
                className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Cancel Search
              </button>
            </div>
          )}
        </div>

        {/* Game History (placeholder for future) */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Games</h2>
          <p className="text-gray-600">No recent games found.</p>
        </div>
      </div>
    </div>
  );
};