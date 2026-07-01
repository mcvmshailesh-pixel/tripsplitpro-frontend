import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login', 'register', 'forgot', 'forced-reset'
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Forgot Password / Request Status States
  const [statusEmail, setStatusEmail] = useState('');
  const [requestStatus, setRequestStatus] = useState(null); // { status, createdAt, adminNotes }
  
  // Feedback
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrorMsg('');
    setLoading(true);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      if (mode === 'login') {
        const response = await axios.post(`${apiBaseUrl}/api/auth/login`, { email, password });
        const { token, user } = response.data;
        
        // Save auth details temporarily
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        if (user.mustChangePassword) {
          setMode('forced-reset');
          setErrorMsg('Administrator requires you to change your password before proceeding.');
        } else {
          setMessage('Login successful! Redirecting...');
          setTimeout(() => navigate('/dashboard'), 1000);
        }
      } else if (mode === 'register') {
        // Simple inline validations
        if (password.length < 6) {
          setErrorMsg('Password must be at least 6 characters long.');
          setLoading(false);
          return;
        }
        const response = await axios.post(`${apiBaseUrl}/api/auth/register`, { name, mobile, email, password });
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setMessage('Registration successful! Redirecting...');
        setTimeout(() => navigate('/dashboard'), 1000);
      }
    } catch (error) {
      setErrorMsg(error.response?.data?.message || 'Authentication failed. Please check your credentials.');
      // Clean up localstorage on fail
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrorMsg('');
    setLoading(true);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.post(`${apiBaseUrl}/api/auth/forgot-password`, { email });
      setMessage(response.data.message);
    } catch (error) {
      setErrorMsg(error.response?.data?.message || 'Failed to submit reset request.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckRequestStatus = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrorMsg('');
    setRequestStatus(null);
    setLoading(true);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.post(`${apiBaseUrl}/api/auth/reset-status`, { email: statusEmail });
      setRequestStatus(response.data);
    } catch (error) {
      setErrorMsg(error.response?.data?.message || 'Failed to fetch status.');
    } finally {
      setLoading(false);
    }
  };

  const handleForcedResetSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrorMsg('');
    
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.post(`${apiBaseUrl}/api/auth/change-password-forced`, 
        { newPassword }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local storage user object
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.mustChangePassword = false;
      localStorage.setItem('user', JSON.stringify(user));

      setMessage(response.data.message + ' Redirecting...');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (error) {
      setErrorMsg(error.response?.data?.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '85vh',
      fontFamily: 'var(--sans)',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '450px',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: 'var(--shadow)',
        boxSizing: 'border-box',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '36px', margin: '0 0 10px 0', letterSpacing: '-1.5px', fontWeight: '800', color: 'var(--text-h)' }}>
            TripSplit Pro ✈️
          </h1>
          <p style={{ margin: 0, color: 'var(--text)', fontSize: '15px' }}>
            {mode === 'login' && 'Simplify trip expense sharing with friends'}
            {mode === 'register' && 'Create your account to start splitting'}
            {mode === 'forgot' && 'Submit password reset request to administrator'}
            {mode === 'forced-reset' && 'Forced Password Change'}
          </p>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            color: '#ef4444',
            fontSize: '14px',
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            {errorMsg}
          </div>
        )}

        {message && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            color: '#10b981',
            fontSize: '14px',
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            {message}
          </div>
        )}

        {/* Login / Register Modes Toggle */}
        {mode !== 'forgot' && mode !== 'forced-reset' && (
          <div style={{
            display: 'flex',
            background: 'var(--code-bg)',
            padding: '6px',
            borderRadius: '12px',
            marginBottom: '25px'
          }}>
            <button 
              type="button"
              onClick={() => { setMode('login'); setErrorMsg(''); setMessage(''); }}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: '8px',
                background: mode === 'login' ? 'var(--bg)' : 'transparent',
                color: mode === 'login' ? 'var(--text-h)' : 'var(--text)',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: mode === 'login' ? '0 4px 6px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.2s',
                fontSize: '14px'
              }}
            >
              Login
            </button>
            <button 
              type="button"
              onClick={() => { setMode('register'); setErrorMsg(''); setMessage(''); }}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: '8px',
                background: mode === 'register' ? 'var(--bg)' : 'transparent',
                color: mode === 'register' ? 'var(--text-h)' : 'var(--text)',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: mode === 'register' ? '0 4px 6px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.2s',
                fontSize: '14px'
              }}
            >
              Register
            </button>
          </div>
        )}

        {/* AUTH FORMS (Login / Register) */}
        {mode !== 'forgot' && mode !== 'forced-reset' && (
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mode === 'register' && (
              <>
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  style={{
                    padding: '14px 16px',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    fontSize: '15px',
                    background: 'var(--bg)',
                    color: 'var(--text-h)',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
                <input 
                  type="text" 
                  placeholder="Mobile Number (Optional)" 
                  value={mobile} 
                  onChange={(e) => setMobile(e.target.value)} 
                  style={{
                    padding: '14px 16px',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    fontSize: '15px',
                    background: 'var(--bg)',
                    color: 'var(--text-h)',
                    outline: 'none'
                  }}
                />
              </>
            )}
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{
                padding: '14px 16px',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                fontSize: '15px',
                background: 'var(--bg)',
                color: 'var(--text-h)',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{
                padding: '14px 16px',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                fontSize: '15px',
                background: 'var(--bg)',
                color: 'var(--text-h)',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />

            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginTop: '-4px' }}>
                <button 
                  type="button" 
                  onClick={() => { setMode('forgot'); setErrorMsg(''); setMessage(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              style={{
                padding: '14px',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 16px rgba(170, 59, 255, 0.15)',
                transition: 'background 0.2s, transform 0.1s',
                marginTop: '10px'
              }}
            >
              {loading ? 'Processing...' : (mode === 'login' ? 'Login' : 'Sign Up')}
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD FORM & STATUS REQUEST VIEW */}
        {mode === 'forgot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '24px' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>Submit Reset Request</h3>
              <input 
                type="email" 
                placeholder="Enter Registered Email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', outline: 'none' }}
              />
              <button 
                type="submit" 
                disabled={loading}
                style={{ padding: '12px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>

            <form onSubmit={handleCheckRequestStatus} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>Track Request Status</h3>
              <input 
                type="email" 
                placeholder="Enter Request Email" 
                value={statusEmail} 
                onChange={(e) => setStatusEmail(e.target.value)} 
                required 
                style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', outline: 'none' }}
              />
              <button 
                type="submit" 
                disabled={loading}
                style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', background: 'transparent', color: 'var(--text-h)' }}
              >
                Check Status
              </button>
            </form>

            {requestStatus && (
              <div style={{ padding: '15px', backgroundColor: 'var(--code-bg)', borderRadius: '12px', fontSize: '14px', textAlign: 'left' }}>
                <p style={{ margin: '0 0 8px 0' }}><strong>Status:</strong> 
                  <span style={{ 
                    marginLeft: '8px', 
                    padding: '3px 8px', 
                    borderRadius: '8px', 
                    fontWeight: 'bold',
                    fontSize: '12px',
                    backgroundColor: requestStatus.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.15)' : (requestStatus.status === 'PENDING' ? 'rgba(255, 193, 7, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                    color: requestStatus.status === 'APPROVED' ? '#10b981' : (requestStatus.status === 'PENDING' ? '#ffc107' : '#ef4444')
                  }}>
                    {requestStatus.status}
                  </span>
                </p>
                {requestStatus.status !== 'NONE' && (
                  <>
                    <p style={{ margin: '0 0 8px 0' }}><strong>Created:</strong> {new Date(requestStatus.createdAt).toLocaleString()}</p>
                    <p style={{ margin: 0 }}><strong>Admin Notes:</strong> {requestStatus.adminNotes || 'None'}</p>
                  </>
                )}
              </div>
            )}

            <button 
              type="button" 
              onClick={() => { setMode('login'); setErrorMsg(''); setMessage(''); setRequestStatus(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', textDecoration: 'underline' }}
            >
              ← Back to Login
            </button>
          </div>
        )}

        {/* FORCED PASSWORD RESET SCREEN */}
        {mode === 'forced-reset' && (
          <form onSubmit={handleForcedResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.3)', borderRadius: '12px', color: '#ffb300', fontSize: '13px', textAlign: 'left', lineHeight: '1.4' }}>
              <strong>Force Reset Required:</strong> You are using a temporary password or the administrator has forced a password change. Please set a new secure password.
            </div>
            <input 
              type="password" 
              placeholder="New Password" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              required 
              style={{ padding: '14px', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '15px', outline: 'none' }}
            />
            <input 
              type="password" 
              placeholder="Confirm New Password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required 
              style={{ padding: '14px', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '15px', outline: 'none' }}
            />
            <button 
              type="submit" 
              disabled={loading}
              style={{ padding: '14px', backgroundColor: '#e0a800', color: 'black', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
            >
              {loading ? 'Updating Password...' : 'Update Password & Login'}
            </button>
            <button 
              type="button" 
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setMode('login');
                setErrorMsg('');
                setMessage('');
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
            >
              Cancel & Logout
            </button>
          </form>
        )}
      </div>
    </div>
  );
}