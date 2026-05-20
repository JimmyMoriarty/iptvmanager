'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Shield, Eye, EyeOff, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { authApi, setAccessToken } from '@/lib/api';

type Stage = 'credentials' | 'totp' | 'totp-setup';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('credentials');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', totpCode: '' });
  const [tempToken, setTempToken] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(form.username, form.password);

      if (result?.requiresTotp) {
        setStage('totp');
      } else if (result?.totpSetupRequired) {
        // Load TOTP setup
        setTempToken(result.accessToken);
        setAccessToken(result.accessToken);
        const setup = await authApi.totpSetup();
        setQrCode(setup.qrCode);
        setTotpSecret(setup.secret);
        setStage('totp-setup');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.username, form.password, form.totpCode);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Invalid TOTP code');
    } finally {
      setLoading(false);
    }
  };

  const handleTotpSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.totpConfirm(form.totpCode);
      toast.success('2FA enabled! Redirecting...');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px]
                        bg-brand-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
                          bg-brand-600/20 border border-brand-500/30 mb-4 shadow-xl shadow-brand-600/20">
            <Shield className="w-7 h-7 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">IPTV Manager</h1>
          <p className="text-slate-500 text-sm mt-1">Secure Admin Access</p>
        </div>

        {/* Card */}
        <div className="card-glass border border-white/[0.1] shadow-2xl">

          {/* Credentials Stage */}
          {stage === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Sign in to your account</h2>

              <div>
                <label className="input-label">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    className="input pl-10"
                    type="text"
                    placeholder="admin"
                    autoComplete="username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    className="input pl-10 pr-10"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="btn-primary w-full justify-center py-2.5 mt-2">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : 'Continue'}
              </button>
            </form>
          )}

          {/* TOTP Stage */}
          {stage === 'totp' && (
            <form onSubmit={handleTotp} className="space-y-4">
              <div className="text-center py-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl
                                bg-brand-600/20 border border-brand-500/30 mb-3">
                  <Shield className="w-6 h-6 text-brand-400" />
                </div>
                <h2 className="text-sm font-semibold text-slate-200">Two-Factor Authentication</h2>
                <p className="text-xs text-slate-500 mt-1">Enter the 6-digit code from your authenticator app</p>
              </div>

              <div>
                <label className="input-label">TOTP Code</label>
                <input
                  className="input text-center text-xl tracking-[0.5em] font-mono"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={form.totpCode}
                  onChange={(e) => setForm({ ...form, totpCode: e.target.value.replace(/\D/g, '') })}
                  autoFocus
                  required
                />
              </div>

              <button type="submit" disabled={loading || form.totpCode.length !== 6}
                className="btn-primary w-full justify-center py-2.5">
                {loading ? 'Verifying...' : 'Verify'}
              </button>

              <button type="button" onClick={() => setStage('credentials')}
                className="btn-ghost w-full justify-center text-xs">
                ← Back
              </button>
            </form>
          )}

          {/* TOTP Setup Stage */}
          {stage === 'totp-setup' && (
            <form onSubmit={handleTotpSetup} className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-200 mb-1">Set Up Two-Factor Authentication</h2>
                <p className="text-xs text-slate-500">Scan this QR code with Google Authenticator or Authy</p>
              </div>

              {qrCode && (
                <div className="flex justify-center p-4 bg-white rounded-xl">
                  <img src={qrCode} alt="TOTP QR Code" className="w-40 h-40" />
                </div>
              )}

              {totpSecret && (
                <div>
                  <label className="input-label">Manual Entry Key</label>
                  <code className="block w-full p-2.5 bg-surface-900 rounded-lg text-xs font-mono
                                    text-brand-300 border border-white/[0.06] break-all text-center tracking-wider">
                    {totpSecret}
                  </code>
                </div>
              )}

              <div>
                <label className="input-label">Verify Code</label>
                <input
                  className="input text-center text-xl tracking-[0.5em] font-mono"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={form.totpCode}
                  onChange={(e) => setForm({ ...form, totpCode: e.target.value.replace(/\D/g, '') })}
                  required
                />
              </div>

              <button type="submit" disabled={loading || form.totpCode.length !== 6}
                className="btn-primary w-full justify-center py-2.5">
                {loading ? 'Enabling...' : 'Enable 2FA & Continue'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Protected by end-to-end encryption · TLS 1.3
        </p>
      </div>
    </div>
  );
}
