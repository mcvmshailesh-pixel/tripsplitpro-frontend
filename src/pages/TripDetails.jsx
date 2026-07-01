import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

export default function TripDetails() {
  const { id } = useParams(); 
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses', 'advances', 'pettycash', 'reports', 'settings'

  // Backend data states
  const [trip, setTrip] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState(null);
  const [advances, setAdvances] = useState([]);
  const [ledgerData, setLedgerData] = useState(null);
  const [categories, setCategories] = useState([]);
  
  // Feedback
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  // Logged-in User details
  const [currentUser, setCurrentUser] = useState({});

  // Filters for Reports Tab
  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    memberId: '',
    paymentMethod: ''
  });

  // Expense Form State (Advanced Split)
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    date: '',
    category: 'Food',
    splitMethod: 'EQUAL',
    isPettyCash: false,
    cashHolderId: ''
  });
  
  // Custom split parameters state (keyed by user id)
  const [memberSplits, setMemberSplits] = useState({}); // { [userId]: val }
  // Checkbox state for members involved (default all)
  const [activeParticipants, setActiveParticipants] = useState({}); // { [userId]: boolean }
  // Payers allocation state (multiple payers)
  const [isMultiPayer, setIsMultiPayer] = useState(false);
  const [payerPayments, setPayerPayments] = useState({}); // { [userId]: amountPaid }
  
  // Advance Form State
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [newAdvance, setNewAdvance] = useState({
    amount: '',
    paymentMode: 'Cash',
    referenceNumber: '',
    notes: '',
    currency: 'INR'
  });

  // Petty Cash Form State
  const [showPettyForm, setShowPettyForm] = useState(false);
  const [pettyFormMode, setPettyFormMode] = useState('ADD'); // 'ADD', 'WITHDRAW', 'TRANSFER'
  const [newPettyTx, setNewPettyTx] = useState({
    amount: '',
    purpose: '',
    remarks: '',
    fundedById: '',
    cashHolderId: '',
    transferToId: ''
  });

  // Trip Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    budget: '',
    description: '',
    status: 'ACTIVE'
  });

  const [friendEmail, setFriendEmail] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);

  // Toast / Status state
  const triggerToast = (msg, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 4000);
    }
  };

  // Fetch all trip details
  const fetchAllTripDetails = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    try {
      // 1. Fetch Trip details
      const tripRes = await axios.get(`${apiBaseUrl}/api/trips/${id}`, { headers });
      setTrip(tripRes.data);
      setSettingsForm({
        budget: tripRes.data.budget || '',
        description: tripRes.data.description || '',
        status: tripRes.data.status || 'ACTIVE'
      });

      // Initialize split states for all participants
      const participantsMap = {};
      const splitValInit = {};
      participantsMap[tripRes.data.creatorId] = true;
      splitValInit[tripRes.data.creatorId] = '';
      tripRes.data.members.forEach(m => {
        participantsMap[m.userId] = true;
        splitValInit[m.userId] = '';
      });
      setActiveParticipants(participantsMap);
      setMemberSplits(splitValInit);

      // Initialize payers
      const payersInit = {};
      payersInit[tripRes.data.creatorId] = '';
      tripRes.data.members.forEach(m => {
        payersInit[m.userId] = '';
      });
      setPayerPayments(payersInit);

      // Default Petty Cash holder
      setNewExpense(prev => ({ ...prev, cashHolderId: tripRes.data.creatorId }));
      setNewPettyTx(prev => ({ ...prev, cashHolderId: tripRes.data.creatorId, fundedById: tripRes.data.creatorId }));

      // 2. Fetch Expenses
      const expenseRes = await axios.get(`${apiBaseUrl}/api/expenses/trip/${id}`, { headers });
      setExpenses(expenseRes.data);

      // 3. Fetch Balances (includes Minimised Payments)
      const balanceRes = await axios.get(`${apiBaseUrl}/api/expenses/trip/${id}/balances`, { headers });
      setBalances(balanceRes.data);

      // 4. Fetch Advances
      const advanceRes = await axios.get(`${apiBaseUrl}/api/advances/trip/${id}`, { headers });
      setAdvances(advanceRes.data);

      // 5. Fetch Petty Cash Ledger
      const ledgerRes = await axios.get(`${apiBaseUrl}/api/petty-cash/trip/${id}/ledger`, { headers });
      setLedgerData(ledgerRes.data);

      // 6. Fetch Enabled Categories
      const catRes = await axios.get(`${apiBaseUrl}/api/categories`, { headers });
      setCategories(catRes.data);

      // 7. Fetch Available Users (all users in system except current user)
      const usersRes = await axios.get(`${apiBaseUrl}/api/trips/available-users`, { headers });
      // Filter out trip creator and existing members on the client side
      const filtered = usersRes.data.filter(u => 
        u.id !== tripRes.data.creatorId && 
        !tripRes.data.members.some(m => m.userId === u.id)
      );
      setAvailableUsers(filtered);

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to fetch trip data.');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(userData);
    fetchAllTripDetails();
  }, [fetchAllTripDetails]);

  // Real-Time Calculations for Split Form Preview
  const calculateSplitPreview = () => {
    const amountVal = parseFloat(newExpense.amount) || 0;
    if (amountVal <= 0 || !trip) return [];

    const activeList = Object.keys(activeParticipants).filter(uid => activeParticipants[uid]);
    const numActive = activeList.length;
    if (numActive === 0) return [];

    const result = [];
    const splitMethod = newExpense.splitMethod;

    if (splitMethod === 'EQUAL') {
      const share = amountVal / numActive;
      activeList.forEach(uid => {
        result.push({
          userId: uid,
          name: uid === trip.creatorId ? trip.creator.name : trip.members.find(m => m.userId === uid)?.user.name,
          paid: isMultiPayer ? (parseFloat(payerPayments[uid]) || 0) : (uid === (newExpense.isPettyCash ? newExpense.cashHolderId : currentUser.id) ? amountVal : 0),
          owed: share
        });
      });
    } else if (splitMethod === 'UNEQUAL') {
      activeList.forEach(uid => {
        const owedAmt = parseFloat(memberSplits[uid]) || 0;
        result.push({
          userId: uid,
          name: uid === trip.creatorId ? trip.creator.name : trip.members.find(m => m.userId === uid)?.user.name,
          paid: isMultiPayer ? (parseFloat(payerPayments[uid]) || 0) : (uid === (newExpense.isPettyCash ? newExpense.cashHolderId : currentUser.id) ? amountVal : 0),
          owed: owedAmt
        });
      });
    } else if (splitMethod === 'PERCENTAGE') {
      activeList.forEach(uid => {
        const pct = parseFloat(memberSplits[uid]) || 0;
        const share = (pct / 100) * amountVal;
        result.push({
          userId: uid,
          name: uid === trip.creatorId ? trip.creator.name : trip.members.find(m => m.userId === uid)?.user.name,
          paid: isMultiPayer ? (parseFloat(payerPayments[uid]) || 0) : (uid === (newExpense.isPettyCash ? newExpense.cashHolderId : currentUser.id) ? amountVal : 0),
          owed: share
        });
      });
    } else if (splitMethod === 'WEIGHT') {
      let totalWeight = 0;
      activeList.forEach(uid => {
        totalWeight += parseFloat(memberSplits[uid]) || 0;
      });
      activeList.forEach(uid => {
        const wt = parseFloat(memberSplits[uid]) || 0;
        const share = totalWeight > 0 ? (wt / totalWeight) * amountVal : 0;
        result.push({
          userId: uid,
          name: uid === trip.creatorId ? trip.creator.name : trip.members.find(m => m.userId === uid)?.user.name,
          paid: isMultiPayer ? (parseFloat(payerPayments[uid]) || 0) : (uid === (newExpense.isPettyCash ? newExpense.cashHolderId : currentUser.id) ? amountVal : 0),
          owed: share
        });
      });
    } else if (splitMethod === 'QUANTITY') {
      let totalQty = 0;
      activeList.forEach(uid => {
        totalQty += parseFloat(memberSplits[uid]) || 0;
      });
      activeList.forEach(uid => {
        const qty = parseFloat(memberSplits[uid]) || 0;
        const share = totalQty > 0 ? (qty / totalQty) * amountVal : 0;
        result.push({
          userId: uid,
          name: uid === trip.creatorId ? trip.creator.name : trip.members.find(m => m.userId === uid)?.user.name,
          paid: isMultiPayer ? (parseFloat(payerPayments[uid]) || 0) : (uid === (newExpense.isPettyCash ? newExpense.cashHolderId : currentUser.id) ? amountVal : 0),
          owed: share
        });
      });
    }

    return result;
  };

  // Perform split form validations and return message if invalid
  const getSplitValidationMessage = () => {
    const amountVal = parseFloat(newExpense.amount) || 0;
    if (amountVal <= 0) return 'Amount must be greater than zero.';

    const activeList = Object.keys(activeParticipants).filter(uid => activeParticipants[uid]);
    const numActive = activeList.length;
    if (numActive === 0) return 'Please select at least one member to participate.';

    if (isMultiPayer) {
      let totalPaid = 0;
      Object.keys(payerPayments).forEach(uid => {
        totalPaid += parseFloat(payerPayments[uid]) || 0;
      });
      if (Math.abs(totalPaid - amountVal) > 0.05) {
        return `Payer totals (₹${totalPaid.toFixed(2)}) must sum up exactly to the expense amount (₹${amountVal.toFixed(2)}). Delta: ₹${(amountVal - totalPaid).toFixed(2)}`;
      }
    }

    const splitMethod = newExpense.splitMethod;
    if (splitMethod === 'UNEQUAL') {
      let totalOwed = 0;
      activeList.forEach(uid => {
        totalOwed += parseFloat(memberSplits[uid]) || 0;
      });
      if (Math.abs(totalOwed - amountVal) > 0.05) {
        return `Split shares (₹${totalOwed.toFixed(2)}) must sum up exactly to the expense amount (₹${amountVal.toFixed(2)}). Delta: ₹${(amountVal - totalOwed).toFixed(2)}`;
      }
    } else if (splitMethod === 'PERCENTAGE') {
      let totalPercent = 0;
      activeList.forEach(uid => {
        totalPercent += parseFloat(memberSplits[uid]) || 0;
      });
      if (Math.abs(totalPercent - 100) > 0.01) {
        return `Percentages must total exactly 100% (currently ${totalPercent.toFixed(2)}%).`;
      }
    }

    return null; // Valid
  };

  // Add Expense Submission
  const handleAddExpenseSubmit = async (e) => {
    e.preventDefault();
    const valMsg = getSplitValidationMessage();
    if (valMsg) {
      triggerToast(valMsg, true);
      return;
    }

    const token = localStorage.getItem('token');
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const activeList = Object.keys(activeParticipants).filter(uid => activeParticipants[uid]);

    // Format payers
    let finalPayers = [];
    if (isMultiPayer) {
      Object.keys(payerPayments).forEach(uid => {
        const amt = parseFloat(payerPayments[uid]) || 0;
        if (amt > 0) {
          finalPayers.push({ userId: uid, amountPaid: amt });
        }
      });
    }

    // Format shares
    const finalShares = activeList.map(uid => ({
      userId: uid,
      val: memberSplits[uid] || '0'
    }));

    const expensePayload = {
      tripId: id,
      description: newExpense.description,
      amount: parseFloat(newExpense.amount),
      date: newExpense.date || new Date().toISOString().split('T')[0],
      category: newExpense.category,
      splitMethod: newExpense.splitMethod,
      shares: finalShares,
      payers: finalPayers,
      isPettyCash: newExpense.isPettyCash,
      cashHolderId: newExpense.isPettyCash ? newExpense.cashHolderId : undefined
    };

    try {
      await axios.post(`${apiBaseUrl}/api/expenses`, expensePayload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      triggerToast('Expense split recorded successfully!');
      setShowExpenseForm(false);
      
      // Reset forms
      setNewExpense({
        description: '',
        amount: '',
        date: '',
        category: 'Food',
        splitMethod: 'EQUAL',
        isPettyCash: false,
        cashHolderId: trip.creatorId
      });
      // Reset splits
      const splitValInit = {};
      splitValInit[trip.creatorId] = '';
      trip.members.forEach(m => { splitValInit[m.userId] = ''; });
      setMemberSplits(splitValInit);

      fetchAllTripDetails();
    } catch (err) {
      triggerToast(err.response?.data?.message || 'Failed to record expense split', true);
    }
  };

  // Add Advance Submission
  const handleAddAdvanceSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(newAdvance.amount);
    if (isNaN(amt) || amt <= 0) {
      triggerToast('Please specify a positive advance amount.', true);
      return;
    }

    const token = localStorage.getItem('token');
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    try {
      await axios.post(`${apiBaseUrl}/api/advances`, {
        tripId: id,
        userId: currentUser.id,
        amount: amt,
        paymentMode: newAdvance.paymentMode,
        referenceNumber: newAdvance.referenceNumber,
        notes: newAdvance.notes,
        currency: newAdvance.currency
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      triggerToast('Advance payment logged successfully!');
      setShowAdvanceForm(false);
      setNewAdvance({ amount: '', paymentMode: 'Cash', referenceNumber: '', notes: '', currency: 'INR' });
      fetchAllTripDetails();
    } catch (err) {
      triggerToast('Failed to log advance payment.', true);
    }
  };

  // Approve / Reject Advance (Trip Creator or Admin)
  const handleResolveAdvance = async (advId, status) => {
    const token = localStorage.getItem('token');
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    try {
      await axios.put(`${apiBaseUrl}/api/advances/${advId}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      triggerToast(`Advance payment ${status.toLowerCase()} successfully!`);
      fetchAllTripDetails();
    } catch (err) {
      triggerToast('Failed to resolve advance status.', true);
    }
  };

  // Add Petty Cash transaction Submission
  const handlePettyTxSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    let payload = {
      tripId: id,
      cashHolderId: newPettyTx.cashHolderId || currentUser.id,
      purpose: newPettyTx.purpose,
      remarks: newPettyTx.remarks
    };

    if (pettyFormMode === 'ADD') {
      payload.amountAdded = parseFloat(newPettyTx.amount);
      payload.fundedById = newPettyTx.fundedById || currentUser.id;
    } else if (pettyFormMode === 'WITHDRAW') {
      payload.amountWithdrawn = parseFloat(newPettyTx.amount);
    } else if (pettyFormMode === 'TRANSFER') {
      payload.isTransfer = true;
      payload.amount = parseFloat(newPettyTx.amount);
      payload.transferToId = newPettyTx.transferToId;
    }

    try {
      await axios.post(`${apiBaseUrl}/api/petty-cash`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      triggerToast('Petty cash transaction recorded successfully!');
      setShowPettyForm(false);
      setNewPettyTx({ amount: '', purpose: '', remarks: '', fundedById: trip.creatorId, cashHolderId: trip.creatorId, transferToId: '' });
      fetchAllTripDetails();
    } catch (err) {
      triggerToast(err.response?.data?.message || 'Failed to record transaction.', true);
    }
  };

  // Update Trip Settings
  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    try {
      await axios.put(`${apiBaseUrl}/api/trips/${id}`, {
        budget: settingsForm.budget ? parseFloat(settingsForm.budget) : null,
        description: settingsForm.description,
        status: settingsForm.status
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      triggerToast('Trip configurations saved successfully!');
      fetchAllTripDetails();
    } catch (err) {
      triggerToast('Failed to update trip settings.', true);
    }
  };

  // Download CSV Report
  const downloadCSVReport = (reportType) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    let filename = `report_${reportType}.csv`;

    if (reportType === 'expenses') {
      csvContent += "Date,Description,Category,Amount,Paid By,Split Method\n";
      expenses.forEach(exp => {
        csvContent += `"${new Date(exp.date).toLocaleDateString()}","${exp.description}","${exp.category}",${exp.amount},"${exp.paidBy.name}","${exp.splitMethod}"\n`;
      });
    } else if (reportType === 'advances') {
      csvContent += "Date,Member Name,Amount,Payment Mode,Ref No,Notes,Status\n";
      advances.forEach(adv => {
        csvContent += `"${new Date(adv.date).toLocaleDateString()}","${adv.user.name}",${adv.amount},"${adv.paymentMode}","${adv.referenceNumber || ''}","${adv.notes || ''}","${adv.status}"\n`;
      });
    } else if (reportType === 'pettycash') {
      csvContent += "Date,Holder Name,Funded By,Amount Added,Amount Withdrawn,Purpose,Remarks\n";
      ledgerData?.ledger.forEach(tx => {
        csvContent += `"${new Date(tx.date).toLocaleDateString()}","${tx.cashHolder.name}","${tx.fundedBy?.name || ''}",${tx.amountAdded},${tx.amountWithdrawn},"${tx.purpose}","${tx.remarks || ''}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || !trip) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', fontFamily: 'var(--sans)' }}>
        <h2>Loading Trip Details... 🌴</h2>
      </div>
    );
  }

  // Pre-calculations for preview and tables
  const splitPreviewRows = calculateSplitPreview();
  const validationWarning = getSplitValidationMessage();
  const isCreator = trip.creatorId === currentUser.id;

  return (
    <div style={{ padding: '30px 40px', fontFamily: 'var(--sans)', textAlign: 'left', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Title block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '8px 16px', background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '10px' }}>
            ← Back to Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h1 style={{ fontSize: '38px', margin: 0, letterSpacing: '-1.5px', fontWeight: '800' }}>{trip.name} 🎒</h1>
            {trip.status === 'CLOSED' && (
              <span style={{ padding: '4px 12px', background: '#dc3545', color: 'white', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>CLOSED</span>
            )}
          </div>
          <p style={{ margin: '5px 0 0 0', color: 'var(--text)' }}>
            Destination: <strong>{trip.destination}</strong> • Organizer: <strong>{trip.creator.name}</strong>
          </p>
        </div>

        {/* Global budget status summary */}
        {balances && (
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ padding: '12px 20px', backgroundColor: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text)', fontWeight: 'bold' }}>Total Cost</span>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: '800', color: 'var(--text-h)' }}>₹{balances.totalTripCost.toLocaleString()}</h3>
            </div>
            {trip.budget && (
              <div style={{ padding: '12px 20px', backgroundColor: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text)', fontWeight: 'bold' }}>Budget Utilised</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: '800', color: balances.totalTripCost > trip.budget ? '#dc3545' : 'var(--text-h)' }}>
                  {((balances.totalTripCost / trip.budget) * 100).toFixed(0)}%
                </h3>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Global alert feedback */}
      {error && <div style={{ padding: '12px 20px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', borderRadius: '8px', marginBottom: '20px', fontWeight: '600' }}>⚠️ {error}</div>}
      {success && <div style={{ padding: '12px 20px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#10b981', borderRadius: '8px', marginBottom: '20px', fontWeight: '600' }}>✅ {success}</div>}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '30px', gap: '10px', overflowX: 'auto' }}>
        {[
          { id: 'expenses', label: 'Expenses 💸' },
          { id: 'advances', label: 'Advances 💳' },
          { id: 'pettycash', label: 'Petty Cash 💰' },
          { id: 'reports', label: 'Reports 📊' },
          { id: 'settings', label: 'Trip Settings ⚙️' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'transparent',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: 'pointer',
              color: activeTab === t.id ? 'var(--accent)' : 'var(--text)',
              borderBottom: activeTab === t.id ? '3px solid var(--accent)' : '3px solid transparent',
              marginBottom: '-2px',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ============================================================== */}
      {/* 1. EXPENSES TAB */}
      {/* ============================================================== */}
      {activeTab === 'expenses' && (
        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap-reverse' }}>
          {/* Left: Expenses log list */}
          <div style={{ flex: 1, minWidth: '350px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>Trip Expenses Log</h2>
              {trip.status === 'ACTIVE' && (
                <button 
                  onClick={() => setShowExpenseForm(!showExpenseForm)}
                  style={{ padding: '8px 16px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {showExpenseForm ? 'Cancel' : '+ Add Expense'}
                </button>
              )}
            </div>

            {/* EXPENSE FORM */}
            {showExpenseForm && (
              <form onSubmit={handleAddExpenseSubmit} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '15px', 
                marginBottom: '30px', 
                padding: '24px', 
                backgroundColor: 'var(--code-bg)', 
                borderRadius: '16px',
                border: '1px solid var(--border)' 
              }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Add Shared Expense</h3>
                
                {/* Basic details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', gap: '5px' }}>
                    What did you pay for?
                    <input type="text" placeholder="e.g. Flight ticket, Taxi" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} required style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', gap: '5px' }}>
                    Amount (₹)
                    <input type="number" placeholder="0.00" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} required style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }} />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', gap: '5px' }}>
                    Date
                    <input type="date" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', gap: '5px' }}>
                    Category
                    <select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}>
                      {categories.length > 0 ? (
                        categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                      ) : (
                        ['Food', 'Hotel', 'Transport', 'Activities', 'Shopping', 'Miscellaneous'].map(c => <option key={c} value={c}>{c}</option>)
                      )}
                    </select>
                  </label>
                </div>

                {/* Petty cash option */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <input type="checkbox" id="isPettyCash" checked={newExpense.isPettyCash} onChange={e => setNewExpense({...newExpense, isPettyCash: e.target.checked})} />
                  <label htmlFor="isPettyCash" style={{ fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>Paid from Petty Cash Pool</label>
                </div>

                {newExpense.isPettyCash && (
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', gap: '5px' }}>
                    Select Cash Holder
                    <select value={newExpense.cashHolderId} onChange={e => setNewExpense({...newExpense, cashHolderId: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}>
                      <option value={trip.creatorId}>{trip.creator.name} (Creator)</option>
                      {trip.members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
                    </select>
                  </label>
                )}

                {/* Payer Configuration (Multiple Payers support) */}
                {!newExpense.isPettyCash && (
                  <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Payer Allocation</span>
                      <button type="button" onClick={() => setIsMultiPayer(!isMultiPayer)} style={{ fontSize: '12px', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}>
                        {isMultiPayer ? 'Switch to Single Payer' : 'Paid by Multiple Members'}
                      </button>
                    </div>
                    {isMultiPayer ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text)' }}>Input how much each member paid:</span>
                        {[trip.creator, ...trip.members.map(m => m.user)].map(u => (
                          <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px' }}>{u.name}</span>
                            <input 
                              type="number" 
                              placeholder="0" 
                              value={payerPayments[u.id] || ''} 
                              onChange={e => setPayerPayments({ ...payerPayments, [u.id]: e.target.value })} 
                              style={{ width: '100px', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', textAlign: 'right' }} 
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px' }}>
                        Default: Paid by you (<strong>{currentUser.name}</strong>)
                      </div>
                    )}
                  </div>
                )}

                {/* Split Method & Exclude Members Panel */}
                <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', gap: '5px', marginBottom: '15px' }}>
                    Split Method
                    <select value={newExpense.splitMethod} onChange={e => setNewExpense({...newExpense, splitMethod: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}>
                      <option value="EQUAL">Equal Split</option>
                      <option value="UNEQUAL">Unequal (Manual Amount)</option>
                      <option value="PERCENTAGE">Percentage Split</option>
                      <option value="WEIGHT">Weight/Share Based</option>
                      <option value="QUANTITY">Split by Quantity</option>
                    </select>
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Participating Members:</span>
                    {[trip.creator, ...trip.members.map(m => m.user)].map(u => {
                      const isActive = activeParticipants[u.id];
                      return (
                        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input 
                              type="checkbox" 
                              id={`active-${u.id}`} 
                              checked={!!isActive} 
                              onChange={e => setActiveParticipants({ ...activeParticipants, [u.id]: e.target.checked })} 
                            />
                            <label htmlFor={`active-${u.id}`} style={{ fontSize: '13px', cursor: 'pointer' }}>{u.name}</label>
                          </div>
                          
                          {/* Input fields based on split type */}
                          {isActive && newExpense.splitMethod !== 'EQUAL' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <input 
                                type="number" 
                                placeholder={newExpense.splitMethod === 'PERCENTAGE' ? '%' : (newExpense.splitMethod === 'UNEQUAL' ? '₹' : 'qty')} 
                                value={memberSplits[u.id] || ''} 
                                onChange={e => setMemberSplits({ ...memberSplits, [u.id]: e.target.value })} 
                                required
                                style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', textAlign: 'right' }} 
                              />
                              <span style={{ fontSize: '12px' }}>
                                {newExpense.splitMethod === 'PERCENTAGE' && '%'}
                                {newExpense.splitMethod === 'WEIGHT' && 'shares'}
                                {newExpense.splitMethod === 'QUANTITY' && 'units'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Real-time Math Preview Table */}
                {splitPreviewRows.length > 0 && (
                  <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '13px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>Calculation Preview</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                          <th style={{ padding: '6px 0' }}>Name</th>
                          <th style={{ padding: '6px 0', textAlign: 'right' }}>Paid</th>
                          <th style={{ padding: '6px 0', textAlign: 'right' }}>Owes</th>
                          <th style={{ padding: '6px 0', textAlign: 'right' }}>Net Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {splitPreviewRows.map((row, idx) => {
                          const net = row.paid - row.owed;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #f4f4f4' }}>
                              <td style={{ padding: '6px 0' }}>{row.name}</td>
                              <td style={{ padding: '6px 0', textAlign: 'right' }}>₹{row.paid.toFixed(2)}</td>
                              <td style={{ padding: '6px 0', textAlign: 'right' }}>₹{row.owed.toFixed(2)}</td>
                              <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 'bold', color: net >= 0 ? '#28a745' : '#dc3545' }}>
                                {net >= 0 ? `+₹${net.toFixed(2)}` : `-₹${Math.abs(net).toFixed(2)}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Real-time Validation Warn Banner */}
                {validationWarning && (
                  <div style={{ padding: '10px 15px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
                    ❌ {validationWarning}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={!!validationWarning}
                  style={{ padding: '12px', backgroundColor: validationWarning ? '#ccc' : '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: validationWarning ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
                  Save Shared Expense
                </button>
              </form>
            )}

            {/* EXPENSES LIST */}
            {expenses.length === 0 ? (
              <p>No expenses logged for this trip yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {expenses.map(exp => (
                  <div key={exp.id} style={{ 
                    border: '1px solid var(--border)', 
                    padding: '20px', 
                    borderRadius: '16px', 
                    backgroundColor: 'var(--bg)',
                    boxShadow: 'var(--shadow)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-h)', fontSize: '16px', fontWeight: '700' }}>{exp.description}</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text)' }}>
                        Category: <strong>{exp.category}</strong> • Paid by: <strong>{exp.paidBy.name}</strong> • Split: <strong>{exp.splitMethod}</strong>
                      </p>
                      <span style={{ fontSize: '11px', color: 'var(--text)' }}>{new Date(exp.date).toLocaleDateString()}</span>
                    </div>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-h)' }}>₹{exp.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Minimized Payment Settlement Engine */}
          <div style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Add Member Card */}
            {trip.status === 'ACTIVE' && (
              <div style={{ padding: '24px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '20px', boxShadow: 'var(--shadow)' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: '800' }}>Add Member to Trip 👤</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const token = localStorage.getItem('token');
                  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                  try {
                    await axios.post(`${apiBaseUrl}/api/trips/${id}/members`, { email: friendEmail }, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    triggerToast('Member added successfully!');
                    setFriendEmail('');
                    fetchAllTripDetails();
                  } catch (err) {
                    triggerToast(err.response?.data?.message || 'Failed to add member.', true);
                  }
                }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {availableUsers.length > 0 ? (
                    <select
                      value={friendEmail}
                      onChange={e => setFriendEmail(e.target.value)}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', background: 'white', color: 'var(--text-h)' }}
                    >
                      <option value="">-- Select Member from Friends List --</option>
                      {availableUsers.map(u => (
                        <option key={u.id} value={u.email}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text)' }}>No additional users in friends list.</span>
                  )}
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                    <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
                    <span style={{ fontSize: '10px', color: 'var(--text)', textTransform: 'uppercase', fontWeight: 'bold' }}>Or Invite Manually</span>
                    <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
                  </div>

                  <input
                    type="email"
                    placeholder="Enter member's email manually"
                    value={friendEmail}
                    onChange={e => setFriendEmail(e.target.value)}
                    required
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', background: 'white' }}
                  />
                  <button type="submit" style={{ padding: '10px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                    + Add Member
                  </button>
                </form>
              </div>
            )}
            <div style={{ padding: '24px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '20px', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: '800' }}>Suggested Payments ⚖️</h3>
              {balances ? (
                <>
                  <p style={{ fontSize: '14px', color: 'var(--text)' }}>Below is the simplified settlement chain requiring the minimum number of transactions:</p>
                  <hr style={{ margin: '15px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
                  
                  {balances.suggestedPayments.length === 0 ? (
                    <p style={{ fontSize: '14px', color: '#28a745', fontWeight: 'bold' }}>🎉 Everyone is completely settled up!</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {balances.suggestedPayments.map((pay, idx) => (
                        <div key={idx} style={{ 
                          padding: '12px', 
                          backgroundColor: 'var(--code-bg)', 
                          borderRadius: '10px', 
                          borderLeft: '4px solid var(--accent)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <span style={{ fontSize: '13px' }}><strong>{pay.fromName}</strong> owes <strong>{pay.toName}</strong></span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '16px', fontWeight: '800' }}>₹{pay.amount.toFixed(2)}</span>
                            
                            {/* Settle button: only available if logged in user is the payee (the person receiving cash, who marks it completed) */}
                            {pay.to === currentUser.id && trip.status === 'ACTIVE' && (
                              <button
                                onClick={async () => {
                                  const token = localStorage.getItem('token');
                                  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                                  try {
                                    await axios.post(`${apiBaseUrl}/api/expenses/trip/${id}/settle`, {
                                      payerId: pay.from,
                                      amount: pay.amount
                                    }, { headers: { Authorization: `Bearer ${token}` } });
                                    triggerToast('Recorded settlement successfully!');
                                    fetchAllTripDetails();
                                  } catch (err) {
                                    triggerToast('Failed to record settlement.', true);
                                  }
                                }}
                                style={{ padding: '6px 12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                              >
                                Mark Received
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p>Calculating simplified settlements...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. ADVANCES TAB */}
      {/* ============================================================== */}
      {activeTab === 'advances' && (
        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap-reverse' }}>
          {/* Left: Advances history */}
          <div style={{ flex: 1, minWidth: '350px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>Advances Registry</h2>
              {trip.status === 'ACTIVE' && (
                <button 
                  onClick={() => setShowAdvanceForm(!showAdvanceForm)}
                  style={{ padding: '8px 16px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {showAdvanceForm ? 'Cancel' : '+ Request/Log Advance'}
                </button>
              )}
            </div>

            {/* ADVANCE FORM */}
            {showAdvanceForm && (
              <form onSubmit={handleAddAdvanceSubmit} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '15px', 
                marginBottom: '30px', 
                padding: '24px', 
                backgroundColor: 'var(--code-bg)', 
                borderRadius: '16px',
                border: '1px solid var(--border)' 
              }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>Submit Advance Payment</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', gap: '5px' }}>
                    Advance Amount (₹)
                    <input type="number" placeholder="0.00" value={newAdvance.amount} onChange={e => setNewAdvance({...newAdvance, amount: e.target.value})} required style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', gap: '5px' }}>
                    Payment Mode
                    <select value={newAdvance.paymentMode} onChange={e => setNewAdvance({...newAdvance, paymentMode: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}>
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI / GPay / PhonePe</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card Payment</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', gap: '5px' }}>
                    Reference Number (optional)
                    <input type="text" placeholder="e.g. Transaction ID" value={newAdvance.referenceNumber} onChange={e => setNewAdvance({...newAdvance, referenceNumber: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', gap: '5px' }}>
                    Remarks / Notes
                    <input type="text" placeholder="e.g. Flight ticket advance" value={newAdvance.notes} onChange={e => setNewAdvance({...newAdvance, notes: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                  </label>
                </div>

                <button type="submit" style={{ padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Log Advance
                </button>
              </form>
            )}

            {/* ADVANCES HISTORY TABLE */}
            {advances.length === 0 ? (
              <p>No advances logged yet.</p>
            ) : (
              <div style={{ overflowX: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--code-bg)' }}>
                      <th style={{ padding: '12px 15px' }}>Date</th>
                      <th style={{ padding: '12px 15px' }}>Member</th>
                      <th style={{ padding: '12px 15px' }}>Amount</th>
                      <th style={{ padding: '12px 15px' }}>Mode</th>
                      <th style={{ padding: '12px 15px' }}>Status</th>
                      <th style={{ padding: '12px 15px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advances.map(adv => (
                      <tr key={adv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 15px' }}>{new Date(adv.date).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 15px' }}>{adv.user.name}</td>
                        <td style={{ padding: '12px 15px', fontWeight: 'bold' }}>₹{adv.amount.toLocaleString()}</td>
                        <td style={{ padding: '12px 15px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text)' }}>{adv.paymentMode}</span>
                          {adv.referenceNumber && <span style={{ display: 'block', fontSize: '10px', color: '#999' }}>ID: {adv.referenceNumber}</span>}
                        </td>
                        <td style={{ padding: '12px 15px' }}>
                          <span style={{ 
                            padding: '3px 8px', 
                            borderRadius: '8px', 
                            fontSize: '11px', 
                            fontWeight: 'bold',
                            backgroundColor: adv.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.15)' : (adv.status === 'PENDING' ? 'rgba(255, 193, 7, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                            color: adv.status === 'APPROVED' ? '#10b981' : (adv.status === 'PENDING' ? '#ffc107' : '#ef4444')
                          }}>{adv.status}</span>
                        </td>
                        <td style={{ padding: '12px 15px' }}>
                          {adv.status === 'PENDING' && (isCreator || currentUser.role === 'ADMIN') ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button 
                                onClick={() => handleResolveAdvance(adv.id, 'APPROVED')}
                                style={{ padding: '4px 8px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>
                                Approve
                              </button>
                              <button 
                                onClick={() => handleResolveAdvance(adv.id, 'REJECTED')}
                                style={{ padding: '4px 8px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>
                                Reject
                              </button>
                            </div>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: Advance tracking details */}
          <div style={{ width: '350px' }}>
            <div style={{ padding: '24px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '20px', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: '800' }}>Advances Summary 📊</h3>
              {balances ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {balances.advanceBreakdown.map((ab, idx) => (
                    <div key={idx} style={{ padding: '12px', backgroundColor: 'var(--code-bg)', borderRadius: '12px', borderLeft: '4px solid #33C1FF' }}>
                      <p style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>{ab.name}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Total Contributed:</span>
                          <strong>₹{ab.totalAdvance.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Utilised:</span>
                          <span>₹{ab.utilizedAdvance.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Remaining Balance:</span>
                          <span style={{ fontWeight: 'bold', color: ab.remainingAdvance > 0 ? 'var(--accent)' : 'inherit' }}>
                            ₹{ab.remainingAdvance.toFixed(2)}
                          </span>
                        </div>
                        {ab.refundDue > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#28a745', fontWeight: 'bold', borderTop: '1px solid var(--border)', paddingTop: '4px', marginTop: '4px' }}>
                            <span>Refund Due:</span>
                            <span>₹{ab.refundDue.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Loading advance statistics...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. PETTY CASH TAB */}
      {/* ============================================================== */}
      {activeTab === 'pettycash' && (
        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap-reverse' }}>
          {/* Left: Petty Cash ledger statement */}
          <div style={{ flex: 1, minWidth: '350px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>Petty Cash Ledger</h2>
              {trip.status === 'ACTIVE' && (
                <button 
                  onClick={() => setShowPettyForm(!showPettyForm)}
                  style={{ padding: '8px 16px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {showPettyForm ? 'Cancel' : '+ Record Cash Transaction'}
                </button>
              )}
            </div>

            {/* PETTY CASH TRANSACTION FORM */}
            {showPettyForm && (
              <form onSubmit={handlePettyTxSubmit} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '15px', 
                marginBottom: '30px', 
                padding: '24px', 
                backgroundColor: 'var(--code-bg)', 
                borderRadius: '16px',
                border: '1px solid var(--border)' 
              }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>Add Cash Transaction</h3>
                
                {/* Transaction Mode */}
                <div style={{ display: 'flex', background: 'white', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '10px' }}>
                  {['ADD', 'WITHDRAW', 'TRANSFER'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPettyFormMode(m)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '12px',
                        background: pettyFormMode === m ? 'var(--accent)' : 'transparent',
                        color: pettyFormMode === m ? 'white' : 'var(--text)'
                      }}
                    >
                      {m === 'ADD' ? 'Add Cash' : (m === 'WITHDRAW' ? 'Withdraw Cash' : 'Transfer Cash')}
                    </button>
                  ))}
                </div>

                {/* Shared transaction fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', gap: '5px' }}>
                    Amount (₹)
                    <input type="number" placeholder="0.00" value={newPettyTx.amount} onChange={e => setNewPettyTx({...newPettyTx, amount: e.target.value})} required style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', gap: '5px' }}>
                    {pettyFormMode === 'TRANSFER' ? 'From Cash Holder' : 'Cash Holder'}
                    <select value={newPettyTx.cashHolderId} onChange={e => setNewPettyTx({...newPettyTx, cashHolderId: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}>
                      <option value={trip.creatorId}>{trip.creator.name} (Creator)</option>
                      {trip.members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
                    </select>
                  </label>
                </div>

                {pettyFormMode === 'ADD' && (
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', gap: '5px' }}>
                    Funded By (Who contributed this cash?)
                    <select value={newPettyTx.fundedById} onChange={e => setNewPettyTx({...newPettyTx, fundedById: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}>
                      <option value={trip.creatorId}>{trip.creator.name} (Creator)</option>
                      {trip.members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
                    </select>
                  </label>
                )}

                {pettyFormMode === 'TRANSFER' && (
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', gap: '5px' }}>
                    Transfer To Member
                    <select value={newPettyTx.transferToId} onChange={e => setNewPettyTx({...newPettyTx, transferToId: e.target.value})} required style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}>
                      <option value="" disabled>Select Receiver</option>
                      <option value={trip.creatorId}>{trip.creator.name} (Creator)</option>
                      {trip.members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
                    </select>
                  </label>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', gap: '5px' }}>
                    Purpose
                    <input type="text" placeholder="e.g. Taxi payment, Top-up" value={newPettyTx.purpose} onChange={e => setNewPettyTx({...newPettyTx, purpose: e.target.value})} required style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', gap: '5px' }}>
                    Remarks
                    <input type="text" placeholder="Additional details" value={newPettyTx.remarks} onChange={e => setNewPettyTx({...newPettyTx, remarks: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                  </label>
                </div>

                <button type="submit" style={{ padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Record Transaction
                </button>
              </form>
            )}

            {/* LEDGER TRANSACTIONS LIST */}
            {!ledgerData || ledgerData.ledger.length === 0 ? (
              <p>No petty cash transactions recorded yet.</p>
            ) : (
              <div style={{ overflowX: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--code-bg)' }}>
                      <th style={{ padding: '12px 15px' }}>Date</th>
                      <th style={{ padding: '12px 15px' }}>Cash Holder</th>
                      <th style={{ padding: '12px 15px' }}>Received (In)</th>
                      <th style={{ padding: '12px 15px' }}>Spent (Out)</th>
                      <th style={{ padding: '12px 15px' }}>Purpose / Notes</th>
                      <th style={{ padding: '12px 15px' }}>Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.ledger.map(tx => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 15px' }}>{new Date(tx.date).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 15px' }}><strong>{tx.cashHolder.name}</strong></td>
                        <td style={{ padding: '12px 15px', color: '#28a745', fontWeight: tx.amountAdded > 0 ? 'bold' : 'normal' }}>
                          {tx.amountAdded > 0 ? `+₹${tx.amountAdded}` : '-'}
                        </td>
                        <td style={{ padding: '12px 15px', color: '#dc3545', fontWeight: tx.amountWithdrawn > 0 ? 'bold' : 'normal' }}>
                          {tx.amountWithdrawn > 0 ? `-₹${tx.amountWithdrawn}` : '-'}
                        </td>
                        <td style={{ padding: '12px 15px' }}>
                          <span>{tx.purpose}</span>
                          {tx.remarks && <span style={{ display: 'block', fontSize: '11px', color: '#999' }}>{tx.remarks}</span>}
                        </td>
                        <td style={{ padding: '12px 15px', fontWeight: 'bold' }}>₹{tx.runningBalance.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: Cash in hand indicators */}
          <div style={{ width: '350px' }}>
            <div style={{ padding: '24px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '20px', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: '800' }}>Cash in Hand Summary 💰</h3>
              {ledgerData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ padding: '15px', backgroundColor: 'var(--code-bg)', borderRadius: '12px', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Pool Balance</span>
                    <h2 style={{ margin: '5px 0 0 0', color: ledgerData.summary.currentBalance < 1000 ? '#dc3545' : 'var(--text-h)' }}>
                      ₹{ledgerData.summary.currentBalance.toFixed(2)}
                    </h2>
                  </div>
                  
                  <span style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '10px' }}>Cash by Member:</span>
                  {Object.keys(ledgerData.summary.cashInHandByHolder).map(uid => {
                    const amt = ledgerData.summary.cashInHandByHolder[uid];
                    const name = uid === trip.creatorId ? trip.creator.name : trip.members.find(m => m.userId === uid)?.user.name;
                    return (
                      <div key={uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', padding: '8px 12px', backgroundColor: amt < 500 ? 'rgba(220,53,69,0.1)' : 'rgba(40,167,69,0.05)', borderRadius: '8px' }}>
                        <span>{name}</span>
                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ color: amt < 500 ? '#dc3545' : 'inherit' }}>₹{amt.toFixed(2)}</strong>
                          {amt < 500 && <span style={{ display: 'block', fontSize: '9px', color: '#dc3545', fontWeight: 'bold' }}>LOW CASH ⚠️</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p>Loading cash details...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. REPORTS TAB */}
      {/* ============================================================== */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => window.print()}
              style={{ padding: '12px 24px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: 'var(--shadow)' }}
            >
              🖨️ Print Financial Statement (PDF)
            </button>
            <button 
              onClick={() => downloadCSVReport('expenses')}
              style={{ padding: '12px 24px', backgroundColor: 'var(--code-bg)', color: 'var(--text-h)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              📥 Download Expenses CSV
            </button>
            <button 
              onClick={() => downloadCSVReport('advances')}
              style={{ padding: '12px 24px', backgroundColor: 'var(--code-bg)', color: 'var(--text-h)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              📥 Download Advances CSV
            </button>
            <button 
              onClick={() => downloadCSVReport('pettycash')}
              style={{ padding: '12px 24px', backgroundColor: 'var(--code-bg)', color: 'var(--text-h)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              📥 Download Petty Cash CSV
            </button>
          </div>

          {/* Filter options */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
            gap: '15px', 
            padding: '20px', 
            backgroundColor: 'var(--code-bg)', 
            borderRadius: '16px', 
            border: '1px solid var(--border)' 
          }}>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '12px', fontWeight: 'bold', gap: '4px' }}>
              Start Date
              <input type="date" value={reportFilters.startDate} onChange={e => setReportFilters({...reportFilters, startDate: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '12px', fontWeight: 'bold', gap: '4px' }}>
              End Date
              <input type="date" value={reportFilters.endDate} onChange={e => setReportFilters({...reportFilters, endDate: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '12px', fontWeight: 'bold', gap: '4px' }}>
              Category
              <select value={reportFilters.category} onChange={e => setReportFilters({...reportFilters, category: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white' }}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '12px', fontWeight: 'bold', gap: '4px' }}>
              Member
              <select value={reportFilters.memberId} onChange={e => setReportFilters({...reportFilters, memberId: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white' }}>
                <option value="">All Members</option>
                <option value={trip.creatorId}>{trip.creator.name}</option>
                {trip.members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
              </select>
            </label>
          </div>

          {/* PRINTABLE FINANCIAL SHEET MARKUP */}
          <div id="printable-financial-sheet" style={{ 
            padding: '40px', 
            backgroundColor: 'white', 
            border: '1px solid #ddd', 
            borderRadius: '24px', 
            color: 'black' 
          }}>
            <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '3px solid black', paddingBottom: '20px' }}>
              <h1 style={{ fontSize: '32px', margin: '0 0 10px 0', textTransform: 'uppercase', color: 'black' }}>Trip Financial Statement</h1>
              <p style={{ margin: 0, fontSize: '16px' }}>Trip: <strong>{trip.name}</strong> • Destination: <strong>{trip.destination || '-'}</strong></p>
              <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>Generated on: {new Date().toLocaleDateString()} • Organizer: {trip.creator.name}</p>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px', textAlign: 'center' }}>
              <div style={{ border: '2px solid black', padding: '15px', borderRadius: '12px' }}>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Budget</span>
                <h2 style={{ margin: '5px 0 0 0', fontSize: '24px', color: 'black' }}>₹{trip.budget ? trip.budget.toLocaleString() : '-'}</h2>
              </div>
              <div style={{ border: '2px solid black', padding: '15px', borderRadius: '12px' }}>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Cost</span>
                <h2 style={{ margin: '5px 0 0 0', fontSize: '24px', color: 'black' }}>₹{balances?.totalTripCost.toLocaleString() || '0'}</h2>
              </div>
              <div style={{ border: '2px solid black', padding: '15px', borderRadius: '12px' }}>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Advances</span>
                <h2 style={{ margin: '5px 0 0 0', fontSize: '24px', color: 'black' }}>₹{balances?.totalAdvances.toLocaleString() || '0'}</h2>
              </div>
            </div>

            {/* Member balance sheet */}
            <h3 style={{ borderBottom: '2px solid black', paddingBottom: '8px', marginBottom: '15px', fontSize: '18px', textTransform: 'uppercase' }}>Member Contribution Summary</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '40px', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid black', backgroundColor: '#f4f4f4' }}>
                  <th style={{ padding: '10px' }}>Name</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Total Paid</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Total Owed</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {balances?.balances.map((b, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px' }}><strong>{b.name}</strong></td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>₹{b.totalPaid.toFixed(2)}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>₹{b.totalOwed.toFixed(2)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: b.finalBalance >= 0 ? '#28a745' : '#dc3545' }}>
                      {b.finalBalance >= 0 ? `+₹${b.finalBalance.toFixed(2)}` : `-₹${Math.abs(b.finalBalance).toFixed(2)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Settlements suggested */}
            <h3 style={{ borderBottom: '2px solid black', paddingBottom: '8px', marginBottom: '15px', fontSize: '18px', textTransform: 'uppercase' }}>Required Settlement Transactions</h3>
            {balances?.suggestedPayments.length === 0 ? (
              <p style={{ fontStyle: 'italic', marginBottom: '40px' }}>All transactions have been settled. No further payments required.</p>
            ) : (
              <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8', marginBottom: '40px' }}>
                {balances?.suggestedPayments.map((p, idx) => (
                  <li key={idx}>
                    <strong>{p.fromName}</strong> pays <strong>{p.toName}</strong>: <strong>₹{p.amount.toFixed(2)}</strong>
                  </li>
                ))}
              </ul>
            )}

            {/* Signature Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', borderTop: '1px dashed #999', paddingTop: '30px' }}>
              <div style={{ textAlign: 'center', width: '200px' }}>
                <div style={{ height: '50px' }}></div>
                <div style={{ borderTop: '1px solid black', paddingTop: '5px', fontSize: '12px', fontWeight: 'bold' }}>Trip Organizer Signature</div>
              </div>
              <div style={{ textAlign: 'center', width: '200px' }}>
                <div style={{ height: '50px' }}></div>
                <div style={{ borderTop: '1px solid black', paddingTop: '5px', fontSize: '12px', fontWeight: 'bold' }}>Date Verified</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. TRIP SETTINGS / CONFIG TAB */}
      {/* ============================================================== */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '600px' }}>
          <form onSubmit={handleUpdateSettings} style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px', 
            padding: '24px', 
            backgroundColor: 'var(--code-bg)', 
            borderRadius: '20px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)'
          }}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>Configure Trip settings</h3>
            
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', fontWeight: 'bold', gap: '6px' }}>
              Trip Budget (₹)
              <input 
                type="number" 
                value={settingsForm.budget} 
                onChange={e => setSettingsForm({...settingsForm, budget: e.target.value})} 
                disabled={!isCreator}
                style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }} 
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', fontWeight: 'bold', gap: '6px' }}>
              Trip Description / Notes
              <textarea 
                value={settingsForm.description} 
                onChange={e => setSettingsForm({...settingsForm, description: e.target.value})} 
                disabled={!isCreator}
                style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', height: '80px', resize: 'vertical' }} 
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', fontWeight: 'bold', gap: '6px' }}>
              Trip Status
              <select 
                value={settingsForm.status} 
                onChange={e => setSettingsForm({...settingsForm, status: e.target.value})} 
                disabled={!isCreator}
                style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}
              >
                <option value="ACTIVE">ACTIVE (Accepts expenses & settlements)</option>
                <option value="CLOSED">CLOSED (Finalised. Disables updates)</option>
              </select>
            </label>

            {isCreator ? (
              <button type="submit" style={{ padding: '12px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
                Save configurations
              </button>
            ) : (
              <p style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--text)', margin: 0 }}>
                * Only the trip organizer (<strong>{trip.creator.name}</strong>) can change these settings.
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}