'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/lib/api';
import { Settings, User, Lock, Smartphone, ShieldCheck, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passForm.newPassword !== passForm.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (passForm.newPassword.length < 12) {
      return toast.error('Password must be at least 12 characters');
    }

    setLoading(true);
    try {
      await authApi.changePassword({ 
        currentPassword: passForm.currentPassword, 
        newPassword: passForm.newPassword 
      });
      toast.success('Password changed successfully. Please log in again.');
      setTimeout(logout, 2000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm('This will log out all other devices. Continue?')) return;
    try {
      await authApi.logoutAll();
      toast.success('All other sessions revoked');
    } catch {
      toast.error('Action failed');
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 lg:p-8 animate-fade-in max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-400" /> Account Settings
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Info */}
        <div className="md:col-span-1 space-y-6">
          <div className="card">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
                <User className="w-8 h-8 text-brand-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">{user.username}</h3>
                <span className="badge bg-brand-500/10 text-brand-400 mt-1">{user.role}</span>
              </div>
            </div>
            
            <div className="space-y-4 text-sm">
              <div>
                <span className="text-slate-500 block text-xs mb-1 uppercase tracking-wider">Email</span>
                <span className="text-slate-200">{user.email || 'No email set'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs mb-1 uppercase tracking-wider">2FA Status</span>
                <div className="flex items-center gap-2">
                  {user.totpEnabled ? (
                    <><ShieldCheck className="w-4 h-4 text-emerald-400" /> <span className="text-emerald-400 font-medium">Enabled</span></>
                  ) : (
                    <span className="text-red-400 font-medium">Disabled</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="card border-red-500/20 bg-red-500/5">
            <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-red-400" /> Active Sessions
            </h3>
            <p className="text-sm text-slate-400 mb-4">Log out from all other devices and browsers.</p>
            <button onClick={handleRevokeAll} className="btn-danger w-full justify-center">
              <LogOut className="w-4 h-4" /> Revoke All Sessions
            </button>
          </div>
        </div>

        {/* Change Password */}
        <div className="md:col-span-2">
          <div className="card">
            <h3 className="font-semibold text-white mb-6 flex items-center gap-2 border-b border-white/[0.06] pb-4">
              <Lock className="w-4 h-4 text-brand-400" /> Change Password
            </h3>
            
            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
              <div>
                <label className="input-label">Current Password</label>
                <input 
                  type="password" required className="input" 
                  value={passForm.currentPassword} 
                  onChange={e => setPassForm({...passForm, currentPassword: e.target.value})} 
                />
              </div>
              
              <div>
                <label className="input-label">New Password</label>
                <input 
                  type="password" required minLength={12} className="input" 
                  value={passForm.newPassword} 
                  onChange={e => setPassForm({...passForm, newPassword: e.target.value})} 
                />
                <p className="text-xs text-slate-500 mt-1.5">Minimum 12 characters. Must include uppercase, lowercase, number, and special character.</p>
              </div>
              
              <div>
                <label className="input-label">Confirm New Password</label>
                <input 
                  type="password" required className="input" 
                  value={passForm.confirmPassword} 
                  onChange={e => setPassForm({...passForm, confirmPassword: e.target.value})} 
                />
              </div>
              
              <div className="pt-2">
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
