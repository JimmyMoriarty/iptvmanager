'use client';

import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api';
import { Shield, ShieldAlert, History, Key, UserCheck, AlertTriangle } from 'lucide-react';

export default function SecurityPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.auditLogs().then(setLogs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const getActionIcon = (action: string) => {
    if (action.includes('LOGIN')) return <UserCheck className="w-4 h-4 text-emerald-400" />;
    if (action.includes('PASSWORD') || action.includes('TOTP')) return <Key className="w-4 h-4 text-amber-400" />;
    if (action.includes('THEFT') || action.includes('FAILED')) return <ShieldAlert className="w-4 h-4 text-red-400" />;
    return <History className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-brand-400" /> Security & Audit
        </h1>
        <p className="text-sm text-slate-400 mt-1">Review system security events and access logs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card bg-emerald-500/5 border-emerald-500/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><Shield className="w-5 h-5"/></div>
            <h3 className="font-semibold text-emerald-100">SSRF Protection</h3>
          </div>
          <p className="text-sm text-emerald-200/70">Active. Private IPs and internal network access blocked on all fetches.</p>
        </div>
        
        <div className="card bg-brand-500/5 border-brand-500/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-500/20 rounded-lg text-brand-400"><Key className="w-5 h-5"/></div>
            <h3 className="font-semibold text-brand-100">2FA Enforced</h3>
          </div>
          <p className="text-sm text-brand-200/70">Active. TOTP required for all admin accounts.</p>
        </div>

        <div className="card bg-amber-500/5 border-amber-500/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400"><AlertTriangle className="w-5 h-5"/></div>
            <h3 className="font-semibold text-amber-100">Rate Limiting</h3>
          </div>
          <p className="text-sm text-amber-200/70">Active. API requests throttled to prevent brute force.</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-5 border-b border-white/[0.06] bg-surface-900/30">
          <h2 className="text-lg font-semibold text-white">Recent Audit Logs</h2>
        </div>
        
        <div className="table-wrapper border-0 rounded-none overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>User</th>
                <th>Resource</th>
                <th>IP Address</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">No recent events</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className="font-mono text-xs font-medium text-slate-200">{log.action}</span>
                      </div>
                    </td>
                    <td className="text-slate-400">{log.user?.username || 'System'}</td>
                    <td>
                      <span className="px-2 py-1 rounded bg-surface-900 text-[10px] uppercase tracking-wider text-slate-400">
                        {log.resource}
                      </span>
                    </td>
                    <td className="text-slate-400 font-mono text-xs">{log.ipAddress || '—'}</td>
                    <td className="text-slate-500 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
