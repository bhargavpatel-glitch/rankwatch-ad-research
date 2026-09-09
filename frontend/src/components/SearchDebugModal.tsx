import React from 'react';
import { X, Terminal, Cpu, Target, Layers, Zap } from 'lucide-react';
import { SearchResponse } from '../types';

interface SearchDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchResponse: SearchResponse | null;
}

export const SearchDebugModal: React.FC<SearchDebugModalProps> = ({
  isOpen,
  onClose,
  searchResponse
}) => {
  if (!isOpen || !searchResponse) return null;

  const { query, parsedQuery, totalResults, results, tookMs } = searchResponse;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-3xl bg-[#0f1115] border border-[#222630] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="h-14 px-6 border-b border-[#222630] flex items-center justify-between bg-[#0a0b0e]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Search Relevance & Ranking Inspector</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Debug Mode
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#13151a] hover:bg-[#181b21] text-[#94a3b8] hover:text-white transition-colors border border-[#222630]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs font-mono">
          {/* Query Analysis Section */}
          <div className="bg-[#13151a] rounded-xl p-4 border border-[#222630] space-y-3">
            <div className="flex items-center justify-between text-[#94a3b8] font-semibold uppercase text-[11px] tracking-wider">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Cpu className="w-3.5 h-3.5" />
                Query Understanding Pipeline
              </span>
              <span>took {tookMs}ms</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[#64748b]">Raw Input:</span>
                <div className="text-white font-semibold mt-0.5">"{query || '(empty browse)'}"</div>
              </div>
              <div>
                <span className="text-[#64748b]">Normalized:</span>
                <div className="text-white font-semibold mt-0.5">"{parsedQuery.normalized}"</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#222630]">
              <div>
                <span className="text-[#64748b]">Detected Intent:</span>
                <div className="text-[#2fe593] font-bold mt-0.5 uppercase tracking-wide">
                  {parsedQuery.intent}
                </div>
              </div>
              <div>
                <span className="text-[#64748b]">Extracted Brands:</span>
                <div className="text-white mt-0.5">
                  {parsedQuery.detectedBrands.length > 0 ? parsedQuery.detectedBrands.join(', ') : 'None'}
                </div>
              </div>
              <div>
                <span className="text-[#64748b]">Extracted Platforms:</span>
                <div className="text-white mt-0.5">
                  {parsedQuery.detectedPlatforms.length > 0 ? parsedQuery.detectedPlatforms.join(', ') : 'None'}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#222630]">
              <span className="text-[#64748b]">Normalized Term Tokens:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {parsedQuery.terms.map((t, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-[#0a0b0e] text-[#cbd5e1] border border-[#222630]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Ranking Weights & Formula */}
          <div className="bg-[#13151a] rounded-xl p-4 border border-[#222630] space-y-2">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold uppercase text-[11px] tracking-wider">
              <Zap className="w-3.5 h-3.5" />
              Ranking Formula Weights
            </div>
            <p className="text-[#94a3b8] text-[11px] leading-relaxed">
              Final Score = Exact Match (+50.0) + Brand Match (+45.0) + Phrase Match (+35.0) + Title (+22.0) + Semantic Concepts (+20.0) + Topics (+16.0) + Category (+10.0) + Platform (+8.0)
            </p>
          </div>

          {/* Top Candidates Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[#94a3b8] font-semibold uppercase text-[11px] tracking-wider">
              <span className="flex items-center gap-1.5 text-white">
                <Target className="w-3.5 h-3.5 text-[#2fe593]" />
                Top Matched Results Breakdown
              </span>
              <span>{totalResults} total candidate ads</span>
            </div>

            <div className="space-y-2.5">
              {results.slice(0, 4).map((r, idx) => (
                <div key={r.ad.id} className="bg-[#13151a] rounded-xl p-3.5 border border-[#222630] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[#0a0b0e] text-[#cbd5e1] border border-[#222630] flex items-center justify-center font-bold text-[10px]">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-white text-xs">{r.ad.brand}</span>
                      <span className="text-[#64748b] font-mono text-[10px]">({r.ad.platform})</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20 text-[11px]">
                      Score: {r.score}
                    </span>
                  </div>

                  <div className="text-[#cbd5e1] line-clamp-1 text-[11px]">
                    {r.ad.title || r.ad.summary}
                  </div>

                  {/* Score breakdown chips */}
                  <div className="flex flex-wrap gap-2 text-[10px] text-[#94a3b8] bg-[#0a0b0e] p-2 rounded-lg border border-[#222630]">
                    <span>Exact: <b className="text-white">{r.explanation.scoreBreakdown.exactScore}</b></span>
                    <span>Brand: <b className="text-white">{r.explanation.scoreBreakdown.brandScore}</b></span>
                    <span>Phrase: <b className="text-white">{r.explanation.scoreBreakdown.phraseScore}</b></span>
                    <span>Field: <b className="text-white">{r.explanation.scoreBreakdown.fieldScore}</b></span>
                    <span>Semantic: <b className="text-white">{r.explanation.scoreBreakdown.semanticScore}</b></span>
                    <span>Topics: <b className="text-white">{r.explanation.scoreBreakdown.featureScore}</b></span>
                  </div>

                  <div className="text-[10px] text-amber-300/80 italic">
                    Reason: {r.explanation.explanationNote}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
