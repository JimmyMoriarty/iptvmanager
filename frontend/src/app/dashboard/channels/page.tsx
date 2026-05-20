'use client';

import { useState, useEffect } from 'react';
import { channelsApi } from '@/lib/api';
import { Search, Filter, Tv2, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export default function ChannelsPage() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [groups, setGroups] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const [chRes, grpRes] = await Promise.all([
        channelsApi.list({ search, healthStatus: healthFilter, groupTitle: groupFilter, page, limit: 50 }),
        channelsApi.groups()
      ]);
      setChannels(chRes.data);
      setTotalPages(chRes.meta.totalPages);
      setGroups(grpRes);
    } catch {
      toast.error('Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { loadData(); }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [search, healthFilter, groupFilter, page]);

  const toggleStatus = async (id: string, current: boolean) => {
    try {
      await channelsApi.toggle(id, !current);
      setChannels(channels.map(c => c.id === id ? { ...c, isEnabled: !current } : c));
      toast.success(current ? 'Channel disabled' : 'Channel enabled');
    } catch {
      toast.error('Failed to toggle channel');
    }
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in flex flex-col h-[calc(100vh-theme(spacing.16))]">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Tv2 className="w-6 h-6 text-brand-400" /> Channels
          </h1>
          <p className="text-sm text-slate-400 mt-1">Browse and filter all parsed streams</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search channels..."
              className="input pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          
          <select 
            className="input w-auto min-w-[130px] py-[9px]"
            value={healthFilter}
            onChange={(e) => { setHealthFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Health</option>
            <option value="WORKING">Working</option>
            <option value="SLOW">Slow</option>
            <option value="DEAD">Dead</option>
            <option value="UNKNOWN">Unknown</option>
          </select>

          <select 
            className="input w-auto min-w-[150px] py-[9px]"
            value={groupFilter}
            onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Groups</option>
            {groups.map((g) => (
              <option key={g.name} value={g.name}>{g.name} ({g.count})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 table-wrapper bg-surface-800">
        <table className="table">
          <thead className="sticky top-0 bg-surface-800 border-b border-white/10 z-10 shadow-sm">
            <tr>
              <th className="w-12 text-center">Icon</th>
              <th>Name</th>
              <th>Group</th>
              <th>Health</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody className="overflow-y-auto">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading channels...</td></tr>
            ) : channels.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-slate-500">No channels match your filters</td></tr>
            ) : (
              channels.map(ch => (
                <tr key={ch.id} className={clsx(!ch.isEnabled && "opacity-50")}>
                  <td className="text-center">
                    {ch.tvgLogo ? (
                      <img src={ch.tvgLogo} alt="" className="w-8 h-8 rounded object-contain bg-black/20 mx-auto" onError={(e) => e.currentTarget.style.display = 'none'} />
                    ) : (
                      <div className="w-8 h-8 rounded bg-surface-700 flex items-center justify-center mx-auto text-slate-500">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="font-medium text-slate-200">{ch.name}</div>
                    {ch.tvgName && ch.tvgName !== ch.name && <div className="text-[10px] text-slate-500 mt-0.5">TVG: {ch.tvgName}</div>}
                  </td>
                  <td>
                    <span className="px-2 py-1 rounded bg-surface-900 border border-white/5 text-xs text-slate-400">
                      {ch.groupTitle || 'Uncategorized'}
                    </span>
                  </td>
                  <td>
                    <span className={clsx('badge', {
                      'badge-working': ch.healthStatus === 'WORKING',
                      'badge-dead': ch.healthStatus === 'DEAD',
                      'badge-slow': ch.healthStatus === 'SLOW',
                      'badge-unknown': ch.healthStatus === 'UNKNOWN',
                    })}>
                      {ch.healthStatus}
                    </span>
                    {ch.responseTimeMs && <div className="text-[10px] text-slate-500 mt-1">{ch.responseTimeMs}ms</div>}
                  </td>
                  <td className="text-right">
                    <button 
                      onClick={() => toggleStatus(ch.id, ch.isEnabled)}
                      className={clsx("btn-sm border rounded transition-colors", ch.isEnabled ? "border-red-500/20 text-red-400 hover:bg-red-500/10" : "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10")}
                    >
                      {ch.isEnabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-between pt-4 shrink-0 mt-2">
        <div className="text-sm text-slate-500">
          Page {page} of {totalPages || 1}
        </div>
        <div className="flex gap-2">
          <button 
            disabled={page === 1 || loading}
            onClick={() => setPage(p => p - 1)}
            className="btn-secondary btn-sm"
          >
            Previous
          </button>
          <button 
            disabled={page >= totalPages || loading}
            onClick={() => setPage(p => p + 1)}
            className="btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
