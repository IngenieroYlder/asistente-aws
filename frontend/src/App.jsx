import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import { BASE_URL } from './utils/api';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const user = React.useMemo(() => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  }, []);

    useEffect(() => {
        const faviconUrl = user?.company?.favicon_url || user?.globalBranding?.favicon;
        if (faviconUrl) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = `${BASE_URL}/${faviconUrl}`;
        }
    }, [user]);

  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
      // Redirect based on role if unauthorized
      if (user.role === 'superadmin') return <Navigate to="/admin" replace />;
      return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Tenant Dashboard */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'agent', 'superadmin']}>
              <Dashboard />
            </ProtectedRoute>
          } 
        />

        {/* SuperAdmin Dashboard */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
