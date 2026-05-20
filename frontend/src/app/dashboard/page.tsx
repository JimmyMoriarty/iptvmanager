'use client';

import { useEffect, useState } from 'react';
import { adminApi, channelsApi } from '@/lib/api';
import {
  List, Tv2, FileOutput, Activity,
  CheckCircle2, XCircle, AlertCircle, HelpCircle,
  TrendingUp, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';

interface Stats {
  playlists: { total: number; enabled: number };
  channels: { total: number; WORKING: number; DEAD: number; SLOW: number; UNKNOWN: number };
  outputs: number;
  recentPlaylists: any[];
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <div className="stat-card group hover:border-brand-500/20 transition-colors">
      <div className="flex items-start justify-between">
        <div className={clsx('p-2 rounded-lg', color || 'bg-brand-600/15')}>
          <Icon className={clsx('w-5 h-5', color ? 'text-current' : 'text-brand-400')} />
        </div>
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await adminApi.stats();
      setStats(data);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse">
              <div className="w-9 h-9 rounded-lg bg-white/5" />
              <div className="space-y-2">
                <div className="h-8 w-16 bg-white/5 rounded" />
                <div className="h-4 w-24 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const healthData = stats ? [
    { label: 'Working', value: stats.channels.WORKING, icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-400' },
    { label: 'Slow', value: stats.channels.SLOW, icon: AlertCircle, cls: 'bg-amber-500/15 text-amber-400' },
    { label: 'Dead', value: stats.channels.DEAD, icon: XCircle, cls: 'bg-red-500/15 text-red-400' },
    { label: 'Unknown', value: stats.channels.UNKNOWN, icon: HelpCircle, cls: 'bg-slate-500/15 text-slate-400' },
  ] : [];

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">IPTV Playlist Management Overview</p>
        </div>
        <button onClick={load} className="btn-secondary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={List} label="Total Playlists" value={stats?.playlists.total ?? 0}
          sub={`${stats?.playlists.enabled ?? 0} enabled`} />
        <StatCard icon={Tv2} label="Total Channels" value={stats?.channels.total ?? 0} />
        <StatCard icon={FileOutput} label="Generated Outputs" value={stats?.outputs ?? 0} />
        <StatCard icon={Activity} label="Health Rate"
          value={stats ? `${Math.round((stats.channels.WORKING / Math.max(stats.channels.total, 1)) * 100)}%` : '—'} />
      </div>

      {/* Health breakdown */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Stream Health</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {healthData.map(({ label, value, icon: Icon, cls }) => (
            <div key={label} className="card flex items-center gap-3 hover:border-white/10 transition-colors">
              <div className={clsx('p-2 rounded-lg', cls)}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent playlists */}
      {stats?.recentPlaylists?.length ? (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Recently Updated Playlists
          </h2>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Channels</th>
                  <th>Status</th>
                  <th>Last Synced</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentPlaylists.map((p: any) => (
                  <tr key={p.id}>
                    <td className="font-medium text-white">{p.name}</td>
                    <td>{p.channelCount?.toLocaleString()}</td>
                    <td>
                      <span className={clsx('badge', {
                        'badge-working': p.lastFetchStatus === 'SUCCESS',
                        'badge-dead': p.lastFetchStatus === 'FAILED',
                        'badge-unknown': !p.lastFetchStatus,
                      })}>
                        {p.lastFetchStatus || 'Never'}
                      </span>
                    </td>
                    <td className="text-slate-500 text-xs">
                      {p.lastFetchedAt ? new Date(p.lastFetchedAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
