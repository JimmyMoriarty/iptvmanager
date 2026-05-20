'use client';

import { useState, useEffect } from 'react';
import { outputsApi, playlistsApi } from '@/lib/api';
import { FileOutput, Plus, Copy, RefreshCw, Trash2, Edit2, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function OutputsPage() {
  const [outputs, setOutputs] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    sourcePlaylistIds: [] as string[],
    excludeDead: true,
    sortOrder: 'NAME_ASC'
  });

  const load = async () => {
    try {
      const [outRes, plRes] = await Promise.all([outputsApi.list(), playlistsApi.list({ limit: 100 })]);
      setOutputs(outRes);
      setPlaylists(plRes.data);
    } catch {
      toast.error('Failed to load outputs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.sourcePlaylistIds.length === 0) {
      return toast.error('Select at least one source playlist');
    }
    try {
      if (editId) {
        await outputsApi.update(editId, form);
        toast.success('Output updated');
      } else {
        await outputsApi.create(form);
        toast.success('Output created');
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    }
  };

  const handleRegenerate = async (id: string) => {
    if (!confirm('Regenerate access token? Existing URLs will stop working immediately.')) return;
    try {
      await outputsApi.regenerateToken(id);
      toast.success('Token regenerated');
      load();
    } catch {
      toast.error('Failed to regenerate token');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this output?')) return;
    try {
      await outputsApi.remove(id);
      toast.success('Output deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const copyUrl = (token: string) => {
    const url = `${window.location.origin}/p/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileOutput className="w-6 h-6 text-brand-400" /> Generated Outputs
          </h1>
          <p className="text-sm text-slate-400 mt-1">Create combined dynamic playlists</p>
        </div>
        <button 
          onClick={() => { setEditId(null); setForm({ name: '', description: '', sourcePlaylistIds: [], excludeDead: true, sortOrder: 'NAME_ASC' }); setShowModal(true); }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" /> Create Output
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          [...Array(2)].map((_, i) => <div key={i} className="card animate-pulse h-32" />)
        ) : outputs.length === 0 ? (
          <div className="text-center py-12 card bg-surface-800 border-dashed border-white/10">
            <FileOutput className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-white mb-1">No generated outputs</h3>
            <p className="text-slate-500 mb-4">Combine multiple sources into a single secure playlist URL</p>
            <button onClick={() => setShowModal(true)} className="btn-secondary">Create your first output</button>
          </div>
        ) : (
          outputs.map(out => (
            <div key={out.id} className="card p-0 overflow-hidden flex flex-col md:flex-row border-white/[0.08] hover:border-brand-500/30 transition-colors">
              <div className="p-5 flex-1 border-b md:border-b-0 md:border-r border-white/[0.06]">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{out.name}</h3>
                  <span className={clsx("badge", out.isEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400')}>
                    {out.isEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                {out.description && <p className="text-sm text-slate-400 mb-4">{out.description}</p>}
                
                <div className="flex flex-wrap gap-2 mt-4">
                  {out.sources.map((s: any) => (
                    <span key={s.playlistId} className="px-2 py-1 rounded bg-surface-900 border border-white/10 text-xs text-slate-300 flex items-center gap-1.5">
                      <List className="w-3 h-3 text-brand-400" /> {s.playlist.name}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="w-full md:w-80 bg-surface-900/50 p-5 flex flex-col justify-center">
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Public Playlist URL</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-surface-950 border border-white/[0.06] rounded-md px-3 py-2 text-xs font-mono text-slate-300 truncate select-all">
                      {window.location.origin}/p/{out.token}
                    </div>
                    <button onClick={() => copyUrl(out.token)} className="btn-secondary p-2" title="Copy URL">
                      <Copy className="w-4 h-4 text-slate-400 hover:text-white" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs text-slate-500 mt-auto pt-4 border-t border-white/[0.06]">
                  <div>Accessed: <span className="text-slate-300">{out.accessCount} times</span></div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                       setEditId(out.id);
                       setForm({ name: out.name, description: out.description || '', sourcePlaylistIds: out.sources.map((s:any)=>s.playlistId), excludeDead: out.excludeDead, sortOrder: out.sortOrder });
                       setShowModal(true);
                    }} className="hover:text-white" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleRegenerate(out.id)} className="hover:text-brand-400" title="Regenerate Token"><RefreshCw className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(out.id)} className="hover:text-red-400" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-800 border border-white/10 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-white">{editId ? 'Edit Output' : 'Create Output'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="input-label">Output Name</label>
                <input required type="text" className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Combined Sports & Movies" />
              </div>
              
              <div>
                <label className="input-label">Description (Optional)</label>
                <input type="text" className="input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Internal notes" />
              </div>

              <div>
                <label className="input-label">Source Playlists (Select multiple)</label>
                <div className="bg-surface-900 border border-white/[0.06] rounded-lg max-h-48 overflow-y-auto p-1">
                  {playlists.map(p => (
                    <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        className="rounded border-white/10 bg-surface-800 text-brand-500 focus:ring-brand-500"
                        checked={form.sourcePlaylistIds.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) setForm(f => ({ ...f, sourcePlaylistIds: [...f.sourcePlaylistIds, p.id] }));
                          else setForm(f => ({ ...f, sourcePlaylistIds: f.sourcePlaylistIds.filter(id => id !== p.id) }));
                        }}
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-200">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.channelCount} channels</div>
                      </div>
                    </label>
                  ))}
                  {playlists.length === 0 && <div className="p-4 text-center text-sm text-slate-500">No playlists available. Create one first.</div>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="input-label">Sort Order</label>
                  <select className="input py-2" value={form.sortOrder} onChange={e => setForm({...form, sortOrder: e.target.value})}>
                    <option value="NAME_ASC">Name (A-Z)</option>
                    <option value="GROUP_ASC">Group then Name</option>
                    <option value="ORIGINAL">Original Order</option>
                  </select>
                </div>
                
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white text-slate-300 text-sm w-full h-[42px] px-3 bg-surface-900 border border-white/5 rounded-lg">
                    <input type="checkbox" checked={form.excludeDead} onChange={e => setForm({...form, excludeDead: e.target.checked})} className="rounded bg-surface-800 border-white/10 text-brand-500 focus:ring-brand-500" />
                    Exclude Dead Channels
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-2 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editId ? 'Save Changes' : 'Create Output'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
