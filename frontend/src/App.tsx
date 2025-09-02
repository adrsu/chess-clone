import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { LoginForm } from './components/LoginForm';
import { ChessBoard } from './components/ChessBoard';
// import './App.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useAuth();
  
  if (state.loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  return state.user ? <>{children}</> : <Navigate to="/login" />;
};

const GamePage: React.FC = () => {
  // This would typically get gameId from URL params
  const gameId = 1; // Placeholder
  const playerColor = 'white'; // This should be determined from game data
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Chess Game</h1>
      <ChessBoard gameId={gameId} playerColor={playerColor} />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App min-h-screen bg-gray-100">
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route 
              path="/game" 
              element={
                <ProtectedRoute>
                  <SocketProvider>
                    <GamePage />
                  </SocketProvider>
                </ProtectedRoute>
              } 
            />
            <Route path="/" element={<Navigate to="/game" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
