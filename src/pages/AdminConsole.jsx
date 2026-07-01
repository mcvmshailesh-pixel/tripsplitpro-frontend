import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function AdminConsole() {
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'trips', 'expenses', 'categories', 'resets', 'audits'
  const [users, setUsers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [resetRequests, setResetRequests] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Modal Editing States
  const [editingItem, setEditingItem] = useState(null); // { type: 'user'|'trip'|'expense'|'category'|'resolve-reset', id: ... }
  const [editForm, setEditForm] = useState({});

  // Resolve Reset Request specific fields
  const [resolveForm, setResolveForm] = useState({
    status: 'APPROVED',
    tempPassword: 'temp' + Math.floor(1000 + Math.random() * 9000),
    forceChange: true,
    adminNotes: ''
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const headers = { Authorization: `Bearer ${token}` };

      const [usersRes, tripsRes, expensesRes, categoriesRes, resetsRes, auditsRes] = await Promise.all([
        axios.get(`${apiBaseUrl}/api/admin/users`, { headers }),
        axios.get(`${apiBaseUrl}/api/admin/trips`, { headers }),
        axios.get(`${apiBaseUrl}/api/admin/expenses`, { headers }),
        axios.get(`${apiBaseUrl}/api/admin/categories`, { headers }),
        axios.get(`${apiBaseUrl}/api/admin/reset-requests`, { headers }),
        axios.get(`${apiBaseUrl}/api/admin/audit-logs`, { headers })
      ]);

      setUsers(usersRes.data);
      setTrips(tripsRes.data);
      setExpenses(expensesRes.data);
      setCategories(categoriesRes.data);
      setResetRequests(resetsRes.data);
      setAuditLogs(auditsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch administrator console data.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (type, item) => {
    setEditingItem({ type, id: item?.id });
    
    if (!item) {
      // Add mode
      setEditForm({
        name: '',
        icon: 'folder',
        color: '#6c757d',
        sortOrder: '0',
        isEnabled: true
      });
      return;
    }

    // Edit Mode: Format dates for trip/expense to display correctly in inputs
    const formattedItem = { ...item };
    if (type === 'trip') {
      if (item.startDate) formattedItem.startDate = new Date(item.startDate).toISOString().split('T')[0];
      if (item.endDate) formattedItem.endDate = new Date(item.endDate).toISOString().split('T')[0];
    } else if (type === 'expense') {
      if (item.date) formattedItem.date = new Date(item.date).toISOString().split('T')[0];
    }
    
    setEditForm(formattedItem);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const token = localStorage.getItem('token');
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const headers = { Authorization: `Bearer ${token}` };

    try {
      if (editingItem.type === 'user') {
        await axios.put(`${apiBaseUrl}/api/admin/users/${editingItem.id}`, editForm, { headers });
        setSuccess('User updated successfully!');
      } else if (editingItem.type === 'trip') {
        await axios.put(`${apiBaseUrl}/api/admin/trips/${editingItem.id}`, editForm, { headers });
        setSuccess('Trip updated successfully!');
      } else if (editingItem.type === 'expense') {
        await axios.put(`${apiBaseUrl}/api/admin/expenses/${editingItem.id}`, editForm, { headers });
        setSuccess('Expense updated successfully!');
      } else if (editingItem.type === 'category') {
        if (editingItem.id) {
          // Update category
          await axios.put(`${apiBaseUrl}/api/admin/categories/${editingItem.id}`, editForm, { headers });
          setSuccess('Category updated successfully!');
        } else {
          // Create category
          await axios.post(`${apiBaseUrl}/api/admin/categories`, editForm, { headers });
          setSuccess('Category created successfully!');
        }
      }

      setEditingItem(null);
      fetchAllData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit modifications.');
    }
  };

  const handleDeleteClick = async (type, id) => {
    const confirmDelete = window.confirm(`Are you absolutely sure you want to delete this ${type}?`);
    if (!confirmDelete) return;

    setError('');
    setSuccess('');
    const token = localStorage.getItem('token');
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const headers = { Authorization: `Bearer ${token}` };

    try {
      if (type === 'user') {
        await axios.delete(`${apiBaseUrl}/api/admin/users/${id}`, { headers });
        setSuccess('User and related activities deleted successfully!');
      } else if (type === 'trip') {
        await axios.delete(`${apiBaseUrl}/api/admin/trips/${id}`, { headers });
        setSuccess('Trip deleted successfully!');
      } else if (type === 'expense') {
        await axios.delete(`${apiBaseUrl}/api/admin/expenses/${id}`, { headers });
        setSuccess('Expense deleted successfully!');
      } else if (type === 'category') {
        await axios.delete(`${apiBaseUrl}/api/admin/categories/${id}`, { headers });
        setSuccess('Category soft-deleted successfully!');
      }

      fetchAllData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete item.');
    }
  };

  // Resolve Password Request
  const handleResolveResetRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const token = localStorage.getItem('token');
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const headers = { Authorization: `Bearer ${token}` };

    try {
      await axios.post(`${apiBaseUrl}/api/admin/reset-requests/${editingItem.id}/resolve`, resolveForm, { headers });
      setSuccess(`Reset request successfully resolved!`);
      setEditingItem(null);
      fetchAllData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resolve reset request.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', fontFamily: 'var(--sans)' }}>
        <h2>Loading Administrator Console... ⚙️</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: '30px 40px', fontFamily: 'var(--sans)', textAlign: 'left', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '36px', margin: '0 0 5px 0', letterSpacing: '-1.5px', fontWeight: '800' }}>Admin Console ⚙️</h1>
          <p style={{ margin: 0, color: 'var(--text)' }}>Monitor audits, approve password requests, manage categories and users</p>
        </div>
        <button 
          onClick={fetchAllData}
          style={{ padding: '10px 20px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          🔄 Refresh Console
        </button>
      </div>

      {/* Alert Notifications */}
      {error && <div style={{ padding: '12px 20px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', borderRadius: '8px', marginBottom: '20px', fontWeight: '600' }}>⚠️ {error}</div>}
      {success && <div style={{ padding: '12px 20px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#10b981', borderRadius: '8px', marginBottom: '20px', fontWeight: '600' }}>✅ {success}</div>}

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div style={{ padding: '20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text)', fontSize: '13px', textTransform: 'uppercase' }}>Users</h4>
          <h2 style={{ margin: 0, fontSize: '28px', color: 'var(--text-h)', fontWeight: '800' }}>{users.length} 👤</h2>
        </div>
        <div style={{ padding: '20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text)', fontSize: '13px', textTransform: 'uppercase' }}>Trips</h4>
          <h2 style={{ margin: 0, fontSize: '28px', color: 'var(--text-h)', fontWeight: '800' }}>{trips.length} 🌴</h2>
        </div>
        <div style={{ padding: '20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--text)', fontSize: '13px', textTransform: 'uppercase' }}>Expenses</h4>
          <h2 style={{ margin: 0, fontSize: '28px', color: 'var(--text-h)', fontWeight: '800' }}>{expenses.length} 💸</h2>
        </div>
        <div style={{ padding: '20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', borderLeft: '4px solid #ffb300' }}>
          <h4 style={{ margin: '0 0 6px 0', color: '#ffb300', fontSize: '13px', textTransform: 'uppercase' }}>Reset Requests</h4>
          <h2 style={{ margin: 0, fontSize: '28px', color: '#ffb300', fontWeight: '800' }}>
            {resetRequests.filter(r => r.status === 'PENDING').length} 🔑
          </h2>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '30px', gap: '10px', overflowX: 'auto' }}>
        {[
          { id: 'users', label: 'Users' },
          { id: 'trips', label: 'Trips' },
          { id: 'expenses', label: 'Expenses' },
          { id: 'categories', label: 'Categories 🏷️' },
          { id: 'resets', label: 'Reset Requests 🔑' },
          { id: 'audits', label: 'Audit Logs 📜' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'transparent',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: 'pointer',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text)',
              borderBottom: activeTab === tab.id ? '3px solid var(--accent)' : '3px solid transparent',
              marginBottom: '-2px',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div style={{ overflowX: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
        
        {/* 1. USERS TAB */}
        {activeTab === 'users' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--code-bg)' }}>
                <th style={{ padding: '14px 20px' }}>Name</th>
                <th style={{ padding: '14px 20px' }}>Email</th>
                <th style={{ padding: '14px 20px' }}>Mobile</th>
                <th style={{ padding: '14px 20px' }}>Role</th>
                <th style={{ padding: '14px 20px' }}>Forced Reset</th>
                <th style={{ padding: '14px 20px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: '600' }}>{u.name}</td>
                  <td style={{ padding: '14px 20px' }}>{u.email}</td>
                  <td style={{ padding: '14px 20px' }}>{u.mobile || '-'}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', backgroundColor: u.role === 'ADMIN' ? 'rgba(170, 59, 255, 0.15)' : 'var(--code-bg)', color: u.role === 'ADMIN' ? 'var(--accent)' : 'var(--text)' }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', color: u.mustChangePassword ? '#dc3545' : 'inherit', fontWeight: u.mustChangePassword ? 'bold' : 'normal' }}>
                    {u.mustChangePassword ? 'YES (FORCED)' : 'No'}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEditClick('user', u)} style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}>✏️ Edit</button>
                      <button onClick={() => handleDeleteClick('user', u.id)} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>🗑️ Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 2. TRIPS TAB */}
        {activeTab === 'trips' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--code-bg)' }}>
                <th style={{ padding: '14px 20px' }}>Trip Name</th>
                <th style={{ padding: '14px 20px' }}>Destination</th>
                <th style={{ padding: '14px 20px' }}>Budget</th>
                <th style={{ padding: '14px 20px' }}>Creator</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trips.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: '600' }}>{t.name}</td>
                  <td style={{ padding: '14px 20px' }}>📍 {t.destination || '-'}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 'bold' }}>₹{t.budget ? t.budget.toLocaleString() : '-'}</td>
                  <td style={{ padding: '14px 20px' }}>{t.creator?.name || 'Unknown'}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', backgroundColor: t.status === 'CLOSED' ? 'rgba(220,53,69,0.15)' : 'rgba(40,167,69,0.15)', color: t.status === 'CLOSED' ? '#dc3545' : '#28a745' }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEditClick('trip', t)} style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}>✏️ Edit</button>
                      <button onClick={() => handleDeleteClick('trip', t.id)} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>🗑️ Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 3. EXPENSES TAB */}
        {activeTab === 'expenses' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--code-bg)' }}>
                <th style={{ padding: '14px 20px' }}>Description</th>
                <th style={{ padding: '14px 20px' }}>Amount</th>
                <th style={{ padding: '14px 20px' }}>Category</th>
                <th style={{ padding: '14px 20px' }}>Paid By</th>
                <th style={{ padding: '14px 20px' }}>Trip</th>
                <th style={{ padding: '14px 20px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: '600' }}>{e.description}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 'bold' }}>₹{e.amount}</td>
                  <td style={{ padding: '14px 20px' }}>{e.category}</td>
                  <td style={{ padding: '14px 20px' }}>{e.paidBy?.name}</td>
                  <td style={{ padding: '14px 20px' }}>{e.trip?.name}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEditClick('expense', e)} style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}>✏️ Edit</button>
                      <button onClick={() => handleDeleteClick('expense', e.id)} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>🗑️ Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 4. CATEGORIES TAB (New category manager) */}
        {activeTab === 'categories' && (
          <div>
            <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Active Categories</h3>
              <button onClick={() => handleEditClick('category', null)} style={{ padding: '8px 16px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                + Add Category
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--code-bg)' }}>
                  <th style={{ padding: '14px 20px' }}>Category Name</th>
                  <th style={{ padding: '14px 20px' }}>Icon</th>
                  <th style={{ padding: '14px 20px' }}>Color</th>
                  <th style={{ padding: '14px 20px' }}>Sort Order</th>
                  <th style={{ padding: '14px 20px' }}>Status</th>
                  <th style={{ padding: '14px 20px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => (
                  <tr key={cat.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 20px', fontWeight: '600' }}>{cat.name}</td>
                    <td style={{ padding: '14px 20px' }}>🏷️ {cat.icon}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: cat.color, marginRight: '8px' }}></span>
                      {cat.color}
                    </td>
                    <td style={{ padding: '14px 20px' }}>{cat.sortOrder}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', backgroundColor: cat.isEnabled ? 'rgba(40,167,69,0.15)' : 'var(--code-bg)', color: cat.isEnabled ? '#28a745' : 'var(--text)' }}>
                        {cat.isEnabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEditClick('category', cat)} style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}>✏️ Edit</button>
                        <button onClick={() => handleDeleteClick('category', cat.id)} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>🗑️ Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. RESET REQUESTS TAB (New reset request approval) */}
        {activeTab === 'resets' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--code-bg)' }}>
                <th style={{ padding: '14px 20px' }}>Request Date</th>
                <th style={{ padding: '14px 20px' }}>User Name</th>
                <th style={{ padding: '14px 20px' }}>Email</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px' }}>Notes</th>
                <th style={{ padding: '14px 20px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resetRequests.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: 'var(--text)' }}>No password reset requests logged.</td>
                </tr>
              ) : (
                resetRequests.map(req => (
                  <tr key={req.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 20px' }}>{new Date(req.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '14px 20px', fontWeight: '600' }}>{req.user.name}</td>
                    <td style={{ padding: '14px 20px' }}>{req.user.email}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ 
                        padding: '3px 8px', 
                        borderRadius: '8px', 
                        fontSize: '11px', 
                        fontWeight: 'bold',
                        backgroundColor: req.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.15)' : (req.status === 'PENDING' ? 'rgba(255, 193, 7, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                        color: req.status === 'APPROVED' ? '#10b981' : (req.status === 'PENDING' ? '#ffc107' : '#ef4444')
                      }}>{req.status}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>{req.adminNotes || '-'}</td>
                    <td style={{ padding: '14px 20px' }}>
                      {req.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => { setEditingItem({ type: 'resolve-reset', id: req.id }); setResolveForm(p => ({ ...p, status: 'APPROVED', tempPassword: 'temp' + Math.floor(1000 + Math.random() * 9000) })); }}
                            style={{ padding: '6px 12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                            Approve
                          </button>
                          <button 
                            onClick={() => { setEditingItem({ type: 'resolve-reset', id: req.id }); setResolveForm(p => ({ ...p, status: 'REJECTED' })); }}
                            style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                            Reject
                          </button>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* 6. AUDIT LOGS TAB (New log viewer) */}
        {activeTab === 'audits' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--code-bg)' }}>
                <th style={{ padding: '12px 20px' }}>Timestamp</th>
                <th style={{ padding: '12px 20px' }}>Action</th>
                <th style={{ padding: '12px 20px' }}>Performer Name</th>
                <th style={{ padding: '12px 20px' }}>Details / Remarks</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text)' }}>No audit log history recorded.</td>
                </tr>
              ) : (
                auditLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 20px', color: 'var(--text)' }}>{new Date(log.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '12px 20px', fontWeight: 'bold', color: 'var(--accent)' }}>{log.action}</td>
                    <td style={{ padding: '12px 20px' }}>{log.user ? `${log.user.name} (${log.user.email})` : 'System'}</td>
                    <td style={{ padding: '12px 20px' }}>{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* EDIT MODAL DIALOG */}
      {editingItem && editingItem.type !== 'resolve-reset' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '20px' }}>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '30px', width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow)', boxSizing: 'border-box' }}>
            <h2 style={{ margin: '0 0 20px 0', textTransform: 'capitalize' }}>
              {editingItem.id ? 'Edit' : 'Add'} {editingItem.type}
            </h2>
            
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              {/* User Edit Fields */}
              {editingItem.type === 'user' && (
                <>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Name
                    <input type="text" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} required style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Email
                    <input type="email" value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} required style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Mobile
                    <input type="text" value={editForm.mobile || ''} onChange={e => setEditForm({...editForm, mobile: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    UPI ID
                    <input type="text" value={editForm.upiId || ''} onChange={e => setEditForm({...editForm, upiId: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Role
                    <select value={editForm.role || 'USER'} onChange={e => setEditForm({...editForm, role: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </label>
                </>
              )}

              {/* Trip Edit Fields */}
              {editingItem.type === 'trip' && (
                <>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Trip Name
                    <input type="text" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} required style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Destination
                    <input type="text" value={editForm.destination || ''} onChange={e => setEditForm({...editForm, destination: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Start Date
                    <input type="date" value={editForm.startDate || ''} onChange={e => setEditForm({...editForm, startDate: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    End Date
                    <input type="date" value={editForm.endDate || ''} onChange={e => setEditForm({...editForm, endDate: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Currency
                    <input type="text" value={editForm.currency || 'INR'} onChange={e => setEditForm({...editForm, currency: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Description
                    <textarea value={editForm.description || ''} onChange={e => setEditForm({...editForm, description: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px', height: '60px' }} />
                  </label>
                </>
              )}

              {/* Expense Edit Fields */}
              {editingItem.type === 'expense' && (
                <>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Description
                    <input type="text" value={editForm.description || ''} onChange={e => setEditForm({...editForm, description: e.target.value})} required style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Amount (₹)
                    <input type="number" value={editForm.amount || ''} onChange={e => setEditForm({...editForm, amount: e.target.value})} required style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Category
                    <input type="text" value={editForm.category || ''} onChange={e => setEditForm({...editForm, category: e.target.value})} required style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Date
                    <input type="date" value={editForm.date || ''} onChange={e => setEditForm({...editForm, date: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                </>
              )}

              {/* Category CRUD Fields */}
              {editingItem.type === 'category' && (
                <>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Category Name
                    <input type="text" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} required style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Icon Name (e.g., plane, utensils, car)
                    <input type="text" value={editForm.icon || 'folder'} onChange={e => setEditForm({...editForm, icon: e.target.value})} required style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Color Hex Code
                    <input type="color" value={editForm.color || '#6c757d'} onChange={e => setEditForm({...editForm, color: e.target.value})} required style={{ width: '100%', padding: '5px', marginTop: '5px', boxSizing: 'border-box', height: '40px', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Display Sort Order
                    <input type="number" value={editForm.sortOrder || '0'} onChange={e => setEditForm({...editForm, sortOrder: e.target.value})} required style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                    <input type="checkbox" checked={!!editForm.isEnabled} onChange={e => setEditForm({...editForm, isEnabled: e.target.checked})} />
                    Category Enabled
                  </label>
                </>
              )}

              <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
                <button type="submit" style={{ flex: 1, padding: '12px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>💾 Save Changes</button>
                <button type="button" onClick={() => setEditingItem(null)} style={{ flex: 1, padding: '12px', border: '1px solid var(--border)', backgroundColor: 'transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE RESET MODAL DIALOG */}
      {editingItem && editingItem.type === 'resolve-reset' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '20px' }}>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '30px', width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow)', boxSizing: 'border-box' }}>
            <h2 style={{ margin: '0 0 20px 0' }}>Resolve Password Reset Request</h2>
            
            <form onSubmit={handleResolveResetRequest} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                Status
                <select value={resolveForm.status} onChange={e => setResolveForm({ ...resolveForm, status: e.target.value })} style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <option value="APPROVED">APPROVED (Sets temporary password)</option>
                  <option value="REJECTED">REJECTED (Rejects request)</option>
                </select>
              </label>

              {resolveForm.status === 'APPROVED' && (
                <>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Temporary Password
                    <input type="text" value={resolveForm.tempPassword} onChange={e => setResolveForm({ ...resolveForm, tempPassword: e.target.value })} required style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                    <input type="checkbox" checked={resolveForm.forceChange} onChange={e => setResolveForm({ ...resolveForm, forceChange: e.target.checked })} />
                    Force password change on next login
                  </label>
                </>
              )}

              <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
                Rejection Notes / Remarks (visible to user)
                <input type="text" value={resolveForm.adminNotes} onChange={e => setResolveForm({ ...resolveForm, adminNotes: e.target.value })} placeholder="e.g. Please verify your mobile identity" style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px' }} />
              </label>

              <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
                <button type="submit" style={{ flex: 1, padding: '12px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Submit Resolution</button>
                <button type="button" onClick={() => setEditingItem(null)} style={{ flex: 1, padding: '12px', border: '1px solid var(--border)', backgroundColor: 'transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
