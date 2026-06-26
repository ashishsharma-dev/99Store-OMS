'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Edit3, 
  ShieldAlert, 
  RefreshCcw, 
  Check, 
  X,
  UserCheck,
  UserX
} from 'lucide-react';
import { User, UserRole } from '@/lib/types';

export default function UserAccounts() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form fields
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Order Team');
  const [isActive, setIsActive] = useState(true);
  
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!username.trim() || !name.trim() || !phone.trim() || !password.trim() || !role) {
      setFormError('Please enter all required fields.');
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, phone, password, role, isActive })
      });
      const data = await res.json();
      setFormLoading(false);

      if (res.ok && data.success) {
        setShowAddModal(false);
        resetForm();
        fetchUsers();
      } else {
        setFormError(data.error || 'Failed to create user account.');
      }
    } catch (err) {
      setFormLoading(false);
      setFormError('Network communication error.');
    }
  };

  const handleEditUserToggle = (user: User) => {
    setSelectedUser(user);
    setName(user.name);
    setRole(user.role);
    setIsActive(user.isActive);
    setPhone(user.phone || '');
    setPassword('');
    setFormError('');
    setShowEditModal(true);
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!name.trim() || !phone.trim()) {
      setFormError('Name and Phone are required.');
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedUser.id, name, phone, password, role, isActive })
      });
      const data = await res.json();
      setFormLoading(false);

      if (res.ok && data.success) {
        setShowEditModal(false);
        setSelectedUser(null);
        resetForm();
        fetchUsers();
      } else {
        setFormError(data.error || 'Failed to update user.');
      }
    } catch (err) {
      setFormLoading(false);
      setFormError('Network communication error.');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (confirm(`Are you absolutely sure you want to delete user "${user.name}"?`)) {
      try {
        const res = await fetch(`/api/users?id=${user.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
          fetchUsers();
        } else {
          alert(data.error || 'Failed to delete user.');
        }
      } catch (err) {
        alert('Network communication error.');
      }
    }
  };

  const resetForm = () => {
    setUsername('');
    setName('');
    setPhone('');
    setPassword('');
    setRole('Order Team');
    setIsActive(true);
    setFormError('');
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA' }}>System User Accounts</h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Super Admin dashboard to create, restrict permissions, block, or delete system profiles.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchUsers} className="premium-btn premium-btn-secondary">
            <RefreshCcw size={14} />
          </button>
          <button onClick={() => { resetForm(); setShowAddModal(true); }} className="premium-btn premium-btn-primary">
            <UserPlus size={14} />
            <span>Add User Account</span>
          </button>
        </div>
      </div>

      {/* Main Users Table */}
      {loading ? (
        <div style={{ color: '#737373', fontSize: '14px' }}>Loading system user grids...</div>
      ) : (
        <div className="premium-table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Phone (WhatsApp)</th>
                <th>Assigned Role</th>
                <th>Status</th>
                <th>Last Login IP</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{u.username}</td>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td style={{ fontFamily: 'monospace' }}>{u.phone || 'N/A'}</td>
                  <td>
                    <span className="premium-badge status-created" style={{ fontSize: '11px' }}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {u.isActive ? (
                      <span className="premium-badge status-delivered" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <UserCheck size={11} />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="premium-badge status-return" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <UserX size={11} />
                        <span>Suspended</span>
                      </span>
                    )}
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#737373' }}>
                    {u.lastLoginIp || 'Never logged in'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEditUserToggle(u)}
                        className="premium-btn premium-btn-secondary"
                        style={{ padding: '6px 8px', fontSize: '12px' }}
                      >
                        <Edit3 size={12} />
                      </button>
                      
                      {u.id !== 'usr-1' ? (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="premium-btn premium-btn-danger"
                          style={{ padding: '6px 8px', fontSize: '12px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#737373', padding: '0 8px' }}>Primary</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: Create User Account */}
      {showAddModal && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '440px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>Create User Account</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <form onSubmit={handleCreateUser} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {formError && (
                <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF6868', borderRadius: '6px', padding: '10px 14px', fontSize: '13px' }}>
                  {formError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Username / ID *</label>
                <input
                  type="text"
                  className="premium-input"
                  placeholder="e.g. order_operator"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Full Employee Name *</label>
                <input
                  type="text"
                  className="premium-input"
                  placeholder="e.g. Vikram Seth"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Phone (WhatsApp) *</label>
                <input
                  type="text"
                  className="premium-input"
                  placeholder="e.g. 9999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Password *</label>
                <input
                  type="password"
                  className="premium-input"
                  placeholder="Enter login password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Assigned System Role *</label>
                <select
                  className="premium-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  disabled={formLoading}
                >
                  <option value="Super Admin">Super Admin (All Modules)</option>
                  <option value="Order Team">Order Team (Entries & Dashboard)</option>
                  <option value="Packing Team">Packing Team (Packing lists & AWBs)</option>
                  <option value="Tracking Team">Tracking Team (Courier track & NDRs)</option>
                  <option value="Accounts Team">Accounts Team (CSV Export & Financials)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="user_active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <label htmlFor="user_active" style={{ fontSize: '13px', color: '#FAFAFA', cursor: 'pointer' }}>
                  Enable User Access (Active Status)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '20px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="premium-btn premium-btn-secondary">Close</button>
                <button type="submit" className="premium-btn premium-btn-primary" disabled={formLoading}>
                  {formLoading ? 'Creating profile...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit User Account */}
      {showEditModal && selectedUser && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '440px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>Edit User: {selectedUser.username}</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <form onSubmit={handleSaveUserEdit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {formError && (
                <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF6868', borderRadius: '6px', padding: '10px 14px', fontSize: '13px' }}>
                  {formError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Full Employee Name *</label>
                <input
                  type="text"
                  className="premium-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Phone (WhatsApp) *</label>
                <input
                  type="text"
                  className="premium-input"
                  placeholder="e.g. 9999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Password (Leave blank to keep current)</label>
                <input
                  type="password"
                  className="premium-input"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={formLoading}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Assigned System Role *</label>
                <select
                  className="premium-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  disabled={formLoading || selectedUser.id === 'usr-1'} // Admin role locked
                >
                  <option value="Super Admin">Super Admin (All Modules)</option>
                  <option value="Order Team">Order Team (Entries & Dashboard)</option>
                  <option value="Packing Team">Packing Team (Packing lists & AWBs)</option>
                  <option value="Tracking Team">Tracking Team (Courier track & NDRs)</option>
                  <option value="Accounts Team">Accounts Team (CSV Export & Financials)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="user_active_edit"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                  disabled={selectedUser.id === 'usr-1'} // Admin active status locked
                />
                <label htmlFor="user_active_edit" style={{ fontSize: '13px', color: '#FAFAFA', cursor: 'pointer' }}>
                  Enable User Access (Active Status)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '20px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedUser(null); }} className="premium-btn premium-btn-secondary">Close</button>
                <button type="submit" className="premium-btn premium-btn-primary" disabled={formLoading}>
                  {formLoading ? 'Saving updates...' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
