import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [trips, setTrips] = useState([]);
  const [summary, setSummary] = useState({
    totalBudget: 0,
    totalExpenses: 0,
    totalAdvances: 0,
    cashInHand: 0,
    amountRecoverable: 0,
    amountPayable: 0,
    categoryBreakdown: {},
    tripCosts: [],
    recentTransactions: []
  });
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newTrip, setNewTrip] = useState({
    name: '',
    destination: '',
    startDate: '',
    endDate: '',
    currency: 'INR',
    budget: ''
  });
  const [user, setUser] = useState({});
  const [avatarUrl, setAvatarUrl] = useState('');
  const [welcomeQuote, setWelcomeQuote] = useState('');

  const navigate = useNavigate();

  const TRAVEL_QUOTES = [
    "Adventure is worthwhile in itself. – Amelia Earhart",
    "Collect moments, not things.",
    "Travel is the only thing you buy that makes you richer.",
    "Oh, the places you'll go! – Dr. Seuss",
    "To travel is to live. – Hans Christian Andersen",
    "Life is either a daring adventure or nothing at all. – Helen Keller",
    "The journey of a thousand miles begins with a single step. – Lao Tzu",
    "Wherever you go becomes a part of you somehow. – Anita Desai"
  ];

  useEffect(() => {
    fetchTripsAndSummary();
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(userData);
    setAvatarUrl(userData.avatarUrl || '');
    const randomQuote = TRAVEL_QUOTES[Math.floor(Math.random() * TRAVEL_QUOTES.length)];
    setWelcomeQuote(randomQuote);
  }, []);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        const updatedUser = { ...user, avatarUrl: base64String };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setAvatarUrl(base64String);

        const token = localStorage.getItem('token');
        if (token) {
          try {
            const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            await axios.put(`${apiBaseUrl}/api/auth/profile`, { avatarUrl: base64String }, {
              headers: { Authorization: `Bearer ${token}` }
            });
          } catch (err) {
            console.error('Failed to update avatar in database:', err);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchTripsAndSummary = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }
    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const headers = { Authorization: `Bearer ${token}` };
      
      const tripsResponse = await axios.get(`${apiBaseUrl}/api/trips`, { headers });
      setTrips(tripsResponse.data);

      const summaryResponse = await axios.get(`${apiBaseUrl}/api/trips/dashboard/summary`, { headers });
      setSummary(summaryResponse.data);
    } catch (err) {
      setError('Failed to load dashboard data.');
    }
  };

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.post(`${apiBaseUrl}/api/trips`, {
        ...newTrip,
        budget: newTrip.budget ? parseFloat(newTrip.budget) : null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTrips([response.data.trip, ...trips]);
      setShowForm(false);
      setNewTrip({ name: '', destination: '', startDate: '', endDate: '', currency: 'INR', budget: '' });
      fetchTripsAndSummary();
    } catch (err) {
      alert('Failed to create trip');
    }
  };

  // SVG Chart Computations
  const categories = Object.keys(summary.categoryBreakdown || {});
  const categoryValues = Object.values(summary.categoryBreakdown || {});
  const totalCatSum = categoryValues.reduce((sum, val) => sum + val, 0);

  return (
    <div style={{ padding: '30px 40px', fontFamily: 'var(--sans)', maxWidth: '1200px', margin: '0 auto', textAlign: 'left' }}>
      
      {/* Welcome banner */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'var(--code-bg)', 
        padding: '24px', 
        borderRadius: '20px', 
        marginBottom: '35px', 
        border: '1px solid var(--border)',
        boxShadow: '0 4px 10px rgba(0,0,0,0.01)'
      }}>
        <div style={{ flex: 1, paddingRight: '20px' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: '6px' }}>
            Welcome back, {user.name || 'Explorer'}! 👋
          </span>
          <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text)', fontSize: '15px', lineHeight: '1.4' }}>
            "{welcomeQuote}"
          </p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <label htmlFor="avatar-upload-web" style={{ cursor: 'pointer', display: 'block', position: 'relative' }}>
            <input 
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }} 
              id="avatar-upload-web" 
              onChange={handleAvatarChange} 
            />
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)', boxShadow: 'var(--shadow)' }} />
            ) : (
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px', boxShadow: 'var(--shadow)' }}>
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            )}
          </label>
        </div>
      </div>

      {/* Main KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(170,59,255,0.05) 0%, rgba(170,59,255,0.12) 100%)', border: '1px solid var(--accent-border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text)', fontSize: '13px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Total Budget</h4>
          <h2 style={{ margin: 0, fontSize: '28px', color: 'var(--text-h)', fontWeight: '800' }}>₹{summary.totalBudget.toLocaleString()}</h2>
        </div>
        <div style={{ padding: '20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text)', fontSize: '13px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Total Expenses</h4>
          <h2 style={{ margin: 0, fontSize: '28px', color: 'var(--text-h)', fontWeight: '800' }}>₹{summary.totalExpenses.toLocaleString()}</h2>
        </div>
        <div style={{ padding: '20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text)', fontSize: '13px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Total Advances</h4>
          <h2 style={{ margin: 0, fontSize: '28px', color: 'var(--text-h)', fontWeight: '800' }}>₹{summary.totalAdvances.toLocaleString()}</h2>
        </div>
        <div style={{ padding: '20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text)', fontSize: '13px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Cash in Hand</h4>
          <h2 style={{ margin: 0, fontSize: '28px', color: '#ffb300', fontWeight: '800' }}>₹{summary.cashInHand.toLocaleString()}</h2>
        </div>
        <div style={{ padding: '20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', borderLeft: '4px solid #28a745' }}>
          <h4 style={{ margin: '0 0 6px 0', color: '#28a745', fontSize: '13px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Recoverable</h4>
          <h2 style={{ margin: 0, fontSize: '28px', color: '#28a745', fontWeight: '800' }}>+₹{summary.amountRecoverable.toFixed(2)}</h2>
        </div>
        <div style={{ padding: '20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', borderLeft: '4px solid #dc3545' }}>
          <h4 style={{ margin: '0 0 6px 0', color: '#dc3545', fontSize: '13px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Payable</h4>
          <h2 style={{ margin: 0, fontSize: '28px', color: '#dc3545', fontWeight: '800' }}>-₹{summary.amountPayable.toFixed(2)}</h2>
        </div>
      </div>

      {/* Header and Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>Active Trips 🌴</h2>
        <button 
          onClick={() => setShowForm(!showForm)} 
          style={{ 
            padding: '12px 24px', 
            backgroundColor: 'var(--accent)', 
            color: 'white', 
            border: 'none', 
            borderRadius: '12px', 
            cursor: 'pointer', 
            fontWeight: 'bold',
            boxShadow: '0 4px 10px rgba(170, 59, 255, 0.2)',
            transition: 'transform 0.1s'
          }}
          onMouseDown={(e) => e.target.style.transform = 'scale(0.96)'}
          onMouseUp={(e) => e.target.style.transform = 'none'}
        >
          {showForm ? 'Cancel' : '+ New Trip'}
        </button>
      </div>

      {/* Create Trip Form */}
      {showForm && (
        <form onSubmit={handleCreateTrip} style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '15px', 
          marginBottom: '35px', 
          padding: '25px', 
          backgroundColor: 'var(--code-bg)', 
          borderRadius: '16px',
          border: '1px solid var(--border)'
        }}>
          <input type="text" placeholder="Trip Name (e.g., Paris 2024)" value={newTrip.name} onChange={e => setNewTrip({...newTrip, name: e.target.value})} required style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }} />
          <input type="text" placeholder="Destination" value={newTrip.destination} onChange={e => setNewTrip({...newTrip, destination: e.target.value})} required style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }} />
          <input type="number" placeholder="Budget (₹ - Optional)" value={newTrip.budget} onChange={e => setNewTrip({...newTrip, budget: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }} />
          <input type="date" placeholder="Start Date" value={newTrip.startDate} onChange={e => setNewTrip({...newTrip, startDate: e.target.value})} required style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }} />
          <input type="date" placeholder="End Date" value={newTrip.endDate} onChange={e => setNewTrip({...newTrip, endDate: e.target.value})} required style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }} />
          <button type="submit" style={{ padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', gridColumn: '1 / -1' }}>Save Trip</button>
        </form>
      )}

      {error && <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>}

      {/* Trips Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px', marginBottom: '50px' }}>
        {trips.length === 0 ? (
          <p style={{ gridColumn: '1/-1' }}>You haven't joined or created any trips yet! Click "+ New Trip" to get started.</p>
        ) : (
          trips.map((trip) => {
            const summaryCost = summary.tripCosts.find(c => c.id === trip.id) || { cost: 0, budget: null, status: 'ACTIVE' };
            const percent = summaryCost.budget ? Math.min(100, (summaryCost.cost / summaryCost.budget) * 100) : 0;
            const barColor = percent > 100 ? '#dc3545' : (percent > 85 ? '#ffb300' : 'var(--accent)');

            return (
              <div key={trip.id} style={{ 
                border: '1px solid var(--border)', 
                padding: '24px', 
                borderRadius: '20px', 
                backgroundColor: 'var(--bg)', 
                boxShadow: 'var(--shadow)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {summaryCost.status === 'CLOSED' && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '-32px',
                    background: '#dc3545',
                    color: 'white',
                    padding: '4px 32px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    transform: 'rotate(45deg)',
                    letterSpacing: '1px'
                  }}>
                    CLOSED
                  </div>
                )}
                <div>
                  <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-h)', fontSize: '20px', fontWeight: '800' }}>{trip.name}</h3>
                  <p style={{ margin: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><strong>📍</strong> {trip.destination || 'Not Specified'}</p>
                  <p style={{ margin: '8px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong>📅</strong> {trip.startDate ? new Date(trip.startDate).toLocaleDateString() : '-'} - {trip.endDate ? new Date(trip.endDate).toLocaleDateString() : '-'}
                  </p>
                  
                  {/* Budget progress bar */}
                  {summaryCost.budget ? (
                    <div style={{ marginTop: '20px', marginBottom: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>
                        <span>Spent: ₹{summaryCost.cost.toLocaleString()}</span>
                        <span>Budget: ₹{summaryCost.budget.toLocaleString()}</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--code-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, height: '100%', backgroundColor: barColor, borderRadius: '4px', transition: 'width 0.3s' }}></div>
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: '15px 0 10px 0', fontSize: '13px', fontStyle: 'italic', color: 'var(--text)' }}>
                      Total Cost: ₹{summaryCost.cost.toLocaleString()} (No Budget Set)
                    </p>
                  )}
                </div>
                
                <button 
                  onClick={() => navigate(`/trip/${trip.id}`)} 
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    marginTop: '15px', 
                    backgroundColor: 'transparent',
                    border: '2px solid var(--accent)',
                    color: 'var(--accent)', 
                    borderRadius: '12px', 
                    cursor: 'pointer', 
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.target.style.backgroundColor = 'var(--accent)'; e.target.style.color = 'white'; }}
                  onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--accent)'; }}
                >
                  Open Trip details
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Charts & Analytics Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '30px', marginBottom: '50px' }}>
        
        {/* Trip-wise Financial Summary (Grid form) */}
        <div style={{ padding: '24px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '20px', boxShadow: 'var(--shadow)' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '800' }}>Trip-wise Financial Summary 📊</h3>
          {summary.tripCosts.length === 0 ? (
            <p style={{ fontStyle: 'italic', fontSize: '14px' }}>No trips recorded yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              {summary.tripCosts.map((tc, idx) => {
                const bal = tc.userBalance || 0;
                const statusColor = tc.status === 'CLOSED' ? '#dc3545' : '#28a745';
                const balColor = bal > 0.01 ? '#28a745' : (bal < -0.01 ? '#dc3545' : 'var(--text)');
                
                return (
                  <div key={idx} style={{ 
                    padding: '16px', 
                    backgroundColor: 'var(--code-bg)', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '120px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700', color: 'var(--text-h)', wordBreak: 'break-word' }}>
                          {tc.name}
                        </h4>
                        <span style={{ 
                          fontSize: '9px', 
                          fontWeight: 'bold', 
                          padding: '2px 6px', 
                          borderRadius: '8px', 
                          backgroundColor: tc.status === 'CLOSED' ? 'rgba(220,53,69,0.1)' : 'rgba(40,167,69,0.1)',
                          color: statusColor,
                          whiteSpace: 'nowrap'
                        }}>
                          {tc.status}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text)' }}>
                        Spent: <strong>₹{tc.cost.toLocaleString()}</strong> 
                        {tc.budget ? ` / ₹${tc.budget.toLocaleString()}` : ''}
                      </p>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text)' }}>Your Balance:</span>
                      <strong style={{ fontSize: '13px', color: balColor }}>
                        {bal > 0.01 ? `+₹${bal.toFixed(2)}` : (bal < -0.01 ? `-₹${Math.abs(bal).toFixed(2)}` : '₹0.00')}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Transactions Panel */}
        <div style={{ padding: '24px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '20px', boxShadow: 'var(--shadow)' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '800' }}>Recent Shared Activities 💸</h3>
          {summary.recentTransactions.length === 0 ? (
            <p style={{ fontStyle: 'italic', fontSize: '14px' }}>No transactions recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {summary.recentTransactions.map((tx, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  paddingBottom: '12px',
                  borderBottom: idx === summary.recentTransactions.length - 1 ? 'none' : '1px solid var(--border)'
                }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-h)', fontSize: '15px', fontWeight: '700' }}>{tx.description}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--text)' }}>
                      {tx.tripName} • {tx.category} • {new Date(tx.date).toLocaleDateString()}
                    </span>
                  </div>
                  <span style={{ 
                    fontWeight: 'bold', 
                    color: tx.category === 'Payment' ? '#28a745' : 'var(--text-h)',
                    fontSize: '16px' 
                  }}>
                    {tx.category === 'Payment' ? '+' : '-'}₹{Math.abs(tx.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}