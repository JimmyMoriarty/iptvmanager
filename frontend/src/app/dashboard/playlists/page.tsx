'use client';

import { useState, useEffect } from 'react';
import { playlistsApi } from '@/lib/api';
import { Plus, Search, RefreshCw, Trash2, Edit2, Play, Pause, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    name: '', sourceUrl: '', description: '', isEnabled: true, autoRefresh: true, refreshInterval: 360
  });

  const load = async () => {
    try {
      const res = await playlistsApi.list({ search });
      setPlaylists(res.data);
    } catch {
      toast.error('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        await playlistsApi.update(editId, form);
        toast.success('Playlist updated');
      } else {
        await playlistsApi.create(form);
        toast.success('Playlist created');
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    }
  };

  const openEdit = (p: any) => {
    setForm({
      name: p.name, sourceUrl: p.sourceUrl, description: p.description || '',
      isEnabled: p.isEnabled, autoRefresh: p.autoRefresh, refreshInterval: p.refreshInterval
    });
    setEditId(p.id);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    try {
      await playlistsApi.remove(id);
      toast.success('Playlist deleted');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const handleSync = async (id: string) => {
    const toastId = toast.loading('Syncing playlist...');
    try {
      await playlistsApi.sync(id);
      toast.success('Playlist synced successfully', { id: toastId });
      load();
    } catch (err: any) {
      toast.error(err.message || 'Sync failed', { id: toastId });
    }
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Playlists</h1>
          <p className="text-sm text-slate-400 mt-1">Manage remote M3U sources</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search playlists..."
              className="input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => { setEditId(null); setForm({ name: '', sourceUrl: '', description: '', isEnabled: true, autoRefresh: true, refreshInterval: 360 }); setShowModal(true); }}
            className="btn-primary">
            <Plus className="w-4 h-4" /> New
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse h-48 bg-surface-800" />
          ))
        ) : playlists.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500">
            No playlists found
          </div>
        ) : (
          playlists.map((p) => (
            <div key={p.id} className={clsx("card flex flex-col hover:border-brand-500/20 transition-all", !p.isEnabled && 'opacity-60 grayscale')}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="font-semibold text-white truncate" title={p.name}>{p.name}</h3>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{p.sourceUrl}</p>
                </div>
                <span className={clsx("badge flex-shrink-0", p.isEnabled ? 'badge-working' : 'badge-unknown')}>
                  {p.isEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              
              <div className="text-sm text-slate-300 line-clamp-2 mb-4 flex-1">
                {p.description || 'No description'}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-4 bg-surface-900/50 p-2.5 rounded-lg border border-white/[0.04]">
                <div>
                  <div className="font-medium text-slate-500 uppercase tracking-wider text-[10px] mb-0.5">Channels</div>
                  <div className="text-slate-200">{p.channelCount?.toLocaleString() || 0}</div>
                </div>
                <div>
                  <div className="font-medium text-slate-500 uppercase tracking-wider text-[10px] mb-0.5">Last Sync</div>
                  <div className="text-slate-200">{p.lastFetchedAt ? new Date(p.lastFetchedAt).toLocaleDateString() : 'Never'}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06] mt-auto">
                <button onClick={() => handleSync(p.id)} className="btn-ghost btn-sm text-brand-400 hover:text-brand-300" title="Sync now">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button onClick={() => openEdit(p)} className="btn-ghost btn-sm" title="Edit">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(p.id)} className="btn-ghost btn-sm text-red-400 hover:text-red-300 ml-auto" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-800 border border-white/10 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">{editId ? 'Edit Playlist' : 'Add Playlist'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="input-label">Name</label>
                <input required type="text" className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="My IPTV Provider" />
              </div>
              
              <div>
                <label className="input-label">Source URL (.m3u)</label>
                <input required type="url" className="input" value={form.sourceUrl} onChange={e => setForm({...form, sourceUrl: e.target.value})} placeholder="https://..." />
              </div>

              <div>
                <label className="input-label">Description (Optional)</label>
                <textarea className="input min-h-[80px] resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Notes about this source..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 p-3 rounded-lg border border-white/5 bg-surface-900/50 cursor-pointer hover:border-white/10 transition-colors">
                  <input type="checkbox" checked={form.isEnabled} onChange={e => setForm({...form, isEnabled: e.target.checked})} className="rounded bg-surface-800 border-white/10 text-brand-500 focus:ring-brand-500" />
                  <span className="text-sm font-medium text-slate-300">Enabled</span>
                </label>
                
                <label className="flex items-center gap-2 p-3 rounded-lg border border-white/5 bg-surface-900/50 cursor-pointer hover:border-white/10 transition-colors">
                  <input type="checkbox" checked={form.autoRefresh} onChange={e => setForm({...form, autoRefresh: e.target.checked})} className="rounded bg-surface-800 border-white/10 text-brand-500 focus:ring-brand-500" />
                  <span className="text-sm font-medium text-slate-300">Auto Refresh</span>
                </label>
              </div>

              {form.autoRefresh && (
                <div>
                  <label className="input-label">Refresh Interval (Minutes)</label>
                  <input required type="number" min="15" className="input" value={form.refreshInterval} onChange={e => setForm({...form, refreshInterval: parseInt(e.target.value) || 360})} />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editId ? 'Save Changes' : 'Add Playlist'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
