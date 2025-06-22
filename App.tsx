import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import ChatArea from './components/ChatArea';
import { useAuthStore } from './store/authStore';
import { socketService } from './services/socket';

function App() {
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && token) {
      socketService.connect();
    } else {
      socketService.disconnect();
    }

    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated, token]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route 
            index 
            element={
              isAuthenticated ? <ChatArea /> : <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/login" 
            element={
              !isAuthenticated ? <LoginForm /> : <Navigate to="/" replace />
            } 
          />
          <Route 
            path="/register" 
            element={
              !isAuthenticated ? <RegisterForm /> : <Navigate to="/" replace />
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;