import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar'; 
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TripDetails from './pages/TripDetails';
import AdminConsole from './pages/AdminConsole';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children }) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!token) return <Navigate to="/" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  
  return children;
}

function PublicRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  return (
    <BrowserRouter>
      {/* The Navbar MUST be inside the BrowserRouter, but outside the Routes! */}
      <Navbar /> 
      
      <Routes>
        <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/trip/:id" element={<ProtectedRoute><TripDetails /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminConsole /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;