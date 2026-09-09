import React, { useState, useEffect } from 'react';
import { X, Plus, Database, CheckCircle2, RefreshCw, AlertCircle, ExternalLink, Sparkles } from 'lucide-react';
import { DataSource, SyncStatus } from '../types';

interface DataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus | null;
  onTriggerSync: (sheetId?: string) => void;
}

export const DataSourcesModal: React.FC<DataSourcesModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onTriggerSync
}) => {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addStep, setAddStep] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    fetchSources();
  }, [isOpen]);

  const fetchSources = () => {
    fetch('/api/data-sources')
      .then((res) => res.json())
      .then((data) => setSources(data.sources || []))
      .catch((err) => console.error('Error fetching data sources:', err));
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrl.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setAddStep(1); // Connecting

    try {
      setTimeout(() => setAddStep(3), 600);
      setTimeout(() => setAddStep(5), 1400);

      const res = await fetch('/api/data-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sheetName, url: sheetUrl })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add data source');
      }

      setAddStep(7);
      setTimeout(() => {
        setIsSubmitting(false);
        setIsAdding(false);
        setSheetUrl('');
        setSheetName('');
        setAddStep(0);
        fetchSources();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred');
      setIsSubmitting(false);
      setAddStep(0);
    }
  };

  if (!isOpen) return null;

  const importSteps = [
    'Connecting to Google Sheet',
    'Reading Sheet Metadata',
    'Detecting Tabs & Headers',
    'Reading rows & extracting formulas',
    'Normalizing to Canonical Schema',
    'Validating & Deduplicating',
    'Building Inverted BM25 Search Index',
    'Finalizing Ad Library'
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl bg-[#0f1115] border border-[#222630] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="h-16 px-6 border-b border-[#222630] flex items-center justify-between bg-[#0a0b0e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0e261a] border border-[#184530] flex items-center justify-center text-[#2fe593]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Connected Data Sources</h2>
              <p className="text-[11px] text-[#94a3b8]">Manage Google Sheets & synchronization status</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#13151a] hover:bg-[#181b21] text-[#94a3b8] hover:text-white transition-colors border border-[#222630]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Active Sources List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                Active Google Sheets ({sources.length})
              </span>
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2fe593] hover:bg-[#28d384] text-[#031a0f] text-xs font-bold shadow-md shadow-[#2fe593]/20 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Add Google Sheet</span>
              </button>
            </div>

            <div className="space-y-3">
              {sources.map((src) => (
                <div
                  key={src.id}
                  className="bg-[#13151a] rounded-xl p-4 border border-[#222630] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{src.name}</span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0e261a] text-[#2fe593] border border-[#184530]">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Active
                      </span>
                    </div>

                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#94a3b8] hover:text-[#2fe593] flex items-center gap-1 transition-colors font-mono truncate max-w-md"
                    >
                      <span className="truncate">{src.url}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>

                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#64748b]">
                      <span>Records: <b className="text-white font-mono">{src.recordCount.toLocaleString()}</b></span>
                      <span>•</span>
                      <span>Tabs: <b className="text-[#cbd5e1]">{src.tabs.join(', ')}</b></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onTriggerSync(src.sheetId)}
                      disabled={syncStatus?.isSyncing}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0a0b0e] hover:bg-[#181b21] text-[#cbd5e1] hover:text-white border border-[#222630] text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncStatus?.isSyncing ? 'animate-spin text-amber-400' : 'text-[#2fe593]'}`} />
                      <span>{syncStatus?.isSyncing ? 'Syncing...' : 'Sync Sheet'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Sheet Modal Form */}
          {isAdding && (
            <div className="bg-[#0a0b0e] rounded-xl p-5 border border-[#222630] space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#2fe593]" />
                  Connect New Google Sheet
                </span>
                <button onClick={() => setIsAdding(false)} className="text-[#64748b] hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {isSubmitting ? (
                /* Live Progress Pipeline */
                <div className="space-y-4 py-2">
                  <div className="text-xs font-semibold text-white flex items-center justify-between">
                    <span>Importing & Processing Sheet...</span>
                    <span className="font-mono text-[#2fe593]">{Math.round((addStep / importSteps.length) * 100)}%</span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-[#13151a] overflow-hidden border border-[#222630]">
                    <div
                      className="h-full bg-[#2fe593] transition-all duration-300 rounded-full"
                      style={{ width: `${Math.max(10, Math.round((addStep / importSteps.length) * 100))}%` }}
                    ></div>
                  </div>

                  <div className="space-y-1.5">
                    {importSteps.map((step, idx) => {
                      const isDone = idx < addStep;
                      const isCurrent = idx === addStep;
                      return (
                        <div
                          key={idx}
                          className={`text-xs flex items-center gap-2 transition-colors ${
                            isDone ? 'text-[#2fe593] font-medium' : isCurrent ? 'text-amber-400 font-semibold' : 'text-[#64748b]'
                          }`}
                        >
                          <span className="w-4 text-center font-mono">
                            {isDone ? '✓' : isCurrent ? '●' : '○'}
                          </span>
                          <span>{step}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddSource} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                      Google Sheet URL or ID *
                    </label>
                    <input
                      type="text"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/1tZxJhQ.../edit"
                      required
                      className="w-full px-3 py-2 rounded-xl bg-[#13151a] border border-[#222630] text-xs text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#2fe593]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                      Custom Data Source Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={sheetName}
                      onChange={(e) => setSheetName(e.target.value)}
                      placeholder="e.g. Q4 Competitor Ad Campaigns"
                      className="w-full px-3 py-2 rounded-xl bg-[#13151a] border border-[#222630] text-xs text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#2fe593]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#13151a] hover:bg-[#181b21] text-[#94a3b8] hover:text-white text-xs border border-[#222630] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-[#2fe593] hover:bg-[#28d384] text-[#031a0f] font-bold text-xs shadow-md shadow-[#2fe593]/20 transition-all"
                    >
                      Connect & Import
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
