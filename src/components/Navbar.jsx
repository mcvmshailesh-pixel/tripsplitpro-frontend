import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isAuthenticated = !!localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Theme state
  const [theme, setTheme] = useState('light');

  // Notifications states
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      setTheme('dark');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      setTheme('light');
    }
  }, []);

  // Poll for notifications when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();

    // Check for new notifications every 10 seconds
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const fetchNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.get(`${apiBaseUrl}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const markAllAsRead = async () => {
    const token = localStorage.getItem('token');
    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.put(`${apiBaseUrl}/api/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNotification = async (id, e) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.delete(`${apiBaseUrl}/api/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTheme = () => {
    if (theme === 'light') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
      setTheme('dark');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setTheme('light');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  // We don't want to show the Navbar on the Login screen
  if (location.pathname === '/') return null;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <nav style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '15px 40px', 
      backgroundColor: 'var(--accent)', 
      color: 'white', 
      boxShadow: 'var(--shadow)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <h2 
        style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: 'white', fontSize: '22px', fontWeight: 'bold' }} 
        onClick={() => navigate('/dashboard')}
      >
        TripSplit Pro ✈️
      </h2>
      
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        {/* Manual Theme Toggler */}
        <button 
          onClick={handleToggleTheme}
          title="Toggle light/dark theme"
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {isAuthenticated && (
          <>
            <button 
              onClick={() => navigate('/dashboard')} 
              style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold' }}>
              Dashboard
            </button>
            
            {user.role === 'ADMIN' && (
              <button 
                onClick={() => navigate('/admin')} 
                style={{ background: 'transparent', color: 'rgba(255, 255, 255, 0.9)', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                ⚙️ Admin
              </button>
            )}

            {/* Notification bell widget */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: 'white',
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    border: '2px solid var(--accent)'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown drawer */}
              {showNotifDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '48px',
                  right: 0,
                  width: '320px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  boxShadow: 'var(--shadow)',
                  color: 'var(--text-h)',
                  textAlign: 'left',
                  padding: '15px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', textDecoration: 'underline' }}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  
                  {notifications.length === 0 ? (
                    <p style={{ margin: '15px 0', fontSize: '13px', color: 'var(--text)', textAlign: 'center' }}>No new notifications.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {notifications.map(n => (
                        <div 
                          key={n.id} 
                          style={{
                            padding: '10px',
                            borderRadius: '10px',
                            backgroundColor: n.isRead ? 'transparent' : 'var(--code-bg)',
                            border: '1px solid var(--border)',
                            position: 'relative',
                            fontSize: '12px'
                          }}
                        >
                          <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: n.type === 'SUCCESS' ? '#28a745' : (n.type === 'WARNING' ? '#ffc107' : 'inherit') }}>
                            {n.title}
                          </p>
                          <p style={{ margin: '0 0 6px 0', color: 'var(--text)', lineHeight: '1.3' }}>{n.message}</p>
                          <span style={{ fontSize: '9px', color: '#999' }}>{new Date(n.createdAt).toLocaleTimeString()}</span>
                          
                          <button 
                            onClick={(e) => deleteNotification(n.id, e)}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '11px'
                            }}
                            title="Delete"
                          >
                            ❌
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button 
              onClick={handleLogout} 
              style={{ 
                padding: '8px 20px', 
                backgroundColor: 'white', 
                color: 'var(--accent)', 
                border: 'none', 
                borderRadius: '20px', 
                cursor: 'pointer', 
                fontWeight: 'bold', 
                fontSize: '14px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'transform 0.1s'
              }}
              onMouseOver={(e) => e.target.style.filter = 'brightness(0.95)'}
              onMouseOut={(e) => e.target.style.filter = 'none'}
              onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.target.style.transform = 'none'}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}