import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Copy, Check, Sparkles, Layers, Share2, Eye, Heart, MessageSquare, ChevronRight, Tag, CheckCircle2 } from 'lucide-react';
import { CanonicalAd, SearchResultItem } from '../types';
import { AdCreativeMedia } from './AdCreativeMedia';
import { getBrandLogo } from '../utils/brandLogos';
import { loadPreloadedAds, getClientSimilarAds, getAdDisplayId } from '../utils/clientSearch';

interface AdDetailDrawerProps {
  item: SearchResultItem | null;
  onClose: () => void;
  onSelectSimilar: (ad: CanonicalAd) => void;
}

export const AdDetailDrawer: React.FC<AdDetailDrawerProps> = ({ item, onClose, onSelectSimilar }) => {
  const [similarAds, setSimilarAds] = useState<CanonicalAd[]>([]);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'raw'>('overview');

  useEffect(() => {
    if (!item) return;

    // Fetch similar ads (supports backend API and falls back to preloaded dataset on Netlify)
    setIsLoadingSimilar(true);
    (async () => {
      try {
        const res = await fetch(`/api/ads/${item.ad.id}/similar?limit=6`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.ads)) {
            setSimilarAds(data.ads);
            setIsLoadingSimilar(false);
            return;
          }
        }
      } catch (e) {
        // Backend offline (Netlify static host)
      }
      try {
        const allAds = await loadPreloadedAds();
        setSimilarAds(getClientSimilarAds(allAds, item.ad, 6));
      } catch (err) {
        console.error('Error fetching similar ads:', err);
      } finally {
        setIsLoadingSimilar(false);
      }
    })();
  }, [item?.ad.id]);

  if (!item) return null;

  const { ad, explanation, score } = item;

  const handleCopyCopy = () => {
    navigator.clipboard.writeText(ad.adCopy || ad.summary || ad.title);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      {/* Drawer Container */}
      <div className="w-full max-w-2xl bg-[#0f1115] border-l border-[#222630] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="h-16 px-6 border-b border-[#222630] flex items-center justify-between flex-shrink-0 bg-[#0f1115]/95 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-black border border-[#222630] p-0.5 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
              <img
                src={getBrandLogo(ad.brand)}
                alt={ad.brand}
                className="w-full h-full object-contain rounded-full"
                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white tracking-tight truncate max-w-[200px]">
                {ad.brand}
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] fill-[#10b981]/20" />
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0e261a] text-[#2fe593] border border-[#184530]">
              {ad.platform}
            </span>
            <span
              className="px-2 py-0.5 rounded-md bg-[#181b21] border border-[#262c3a] text-[11px] font-mono text-[#94a3b8] truncate max-w-[130px]"
              title={`Ad ID: ${getAdDisplayId(ad)}`}
            >
              #{getAdDisplayId(ad)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCopy}
              className="p-2 rounded-xl bg-[#13151a] hover:bg-[#181b21] text-[#cbd5e1] hover:text-white transition-colors text-xs flex items-center gap-1.5 border border-[#222630]"
              title="Copy full ad text"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#2fe593]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#13151a] hover:bg-[#181b21] text-[#94a3b8] hover:text-white transition-colors border border-[#222630]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Creative Media Preview */}
          <div className="w-full rounded-2xl bg-[#0a0b0e] border border-[#222630] overflow-hidden shadow-xl">
            <AdCreativeMedia ad={ad} aspectRatio="aspect-video" isDetailedView={true} />
          </div>

          {/* Quick Action Links */}
          <div className="grid grid-cols-2 gap-3">
            {ad.landingPageUrl && (
              <a
                href={ad.landingPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#2fe593] hover:bg-[#28d384] text-[#031a0f] text-xs font-bold shadow-lg shadow-[#2fe593]/20 transition-all active:scale-95 text-center"
              >
                <span>Visit Landing Page</span>
                <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
              </a>
            )}
            {ad.sourceAdUrl && (
              <a
                href={ad.sourceAdUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all border ${
                  ad.landingPageUrl
                    ? 'bg-[#13151a] hover:bg-[#181b21] text-[#cbd5e1] hover:text-white border-[#222630]'
                    : 'col-span-2 bg-[#2fe593] hover:bg-[#28d384] text-[#031a0f] font-bold shadow-lg shadow-[#2fe593]/20'
                }`}
              >
                <span>View on {ad.platform}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Headline & Full Ad Copy */}
          <div className="space-y-3 bg-[#13151a] rounded-2xl p-5 border border-[#222630]">
            <h2 className="text-sm font-bold text-white leading-snug">
              {ad.title || ad.summary}
            </h2>
            <div className="text-xs text-[#94a3b8] leading-relaxed whitespace-pre-wrap">
              {ad.adCopy || ad.summary}
            </div>
            {ad.cta && (
              <div className="pt-2 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#64748b]">Call to Action:</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0e261a] text-[#2fe593] border border-[#184530]">
                  {ad.cta}
                </span>
              </div>
            )}
          </div>

          {/* Topics & Hashtags */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
              Marketing Topics & Features
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs px-2.5 py-1 rounded-lg bg-[#13151a] text-[#cbd5e1] border border-[#222630] font-medium">
                Category: {ad.category}
              </span>
              {ad.topics.map((t, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2.5 py-1 rounded-lg bg-[#0e261a] text-[#2fe593] border border-[#184530] font-medium"
                >
                  {t}
                </span>
              ))}
              {ad.hashtags.map((h, idx) => (
                <span
                  key={`h-${idx}`}
                  className="text-xs px-2.5 py-1 rounded-lg bg-[#0a0b0e] text-[#64748b] border border-[#222630] font-mono"
                >
                  #{h}
                </span>
              ))}
            </div>
          </div>

          {/* Metrics (if available) */}
          {ad.metrics && Object.keys(ad.metrics).length > 0 && (
            <div className="bg-[#13151a] rounded-xl p-4 border border-[#222630] space-y-2">
              <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                Engagement & Impressions
              </div>
              <div className="grid grid-cols-3 gap-3">
                {ad.metrics.views && (
                  <div className="p-2.5 rounded-lg bg-[#0a0b0e] border border-[#222630] text-center">
                    <div className="text-[10px] text-[#64748b]">Views</div>
                    <div className="text-xs font-bold text-white font-mono mt-0.5">{ad.metrics.views}</div>
                  </div>
                )}
                {ad.metrics.likes && (
                  <div className="p-2.5 rounded-lg bg-[#0a0b0e] border border-[#222630] text-center">
                    <div className="text-[10px] text-[#64748b]">Likes</div>
                    <div className="text-xs font-bold text-white font-mono mt-0.5">{ad.metrics.likes}</div>
                  </div>
                )}
                {ad.metrics.comments && (
                  <div className="p-2.5 rounded-lg bg-[#0a0b0e] border border-[#222630] text-center">
                    <div className="text-[10px] text-[#64748b]">Comments</div>
                    <div className="text-xs font-bold text-white font-mono mt-0.5">{ad.metrics.comments}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search Relevance & Match Diagnostics */}
          {explanation && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Why This Matched (Search Score: {Math.round(score)})
                </span>
              </div>
              <p className="text-xs text-[#cbd5e1] leading-relaxed">
                {explanation.explanationNote}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {explanation.matchedFields.map((f, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related Advertisements Section */}
          <div className="space-y-3 pt-4 border-t border-[#222630]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#2fe593]" />
                Related Advertisements
              </h3>
              <span className="text-[11px] text-[#64748b] font-mono">
                {similarAds.length} recommendations
              </span>
            </div>

            {isLoadingSimilar ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="h-28 rounded-xl bg-[#13151a] animate-pulse border border-[#222630]"></div>
                <div className="h-28 rounded-xl bg-[#13151a] animate-pulse border border-[#222630]"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {similarAds.map((sim) => (
                  <div
                    key={sim.id}
                    onClick={() => onSelectSimilar(sim)}
                    className="p-3 rounded-xl bg-[#13151a] hover:bg-[#181b21] border border-[#222630] hover:border-[#2fe593]/40 transition-all cursor-pointer space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-[#2fe593] truncate">{sim.brand}</span>
                      <span className="text-[#64748b] font-mono">{sim.platform}</span>
                    </div>
                    <div className="text-xs font-semibold text-[#cbd5e1] line-clamp-1 group-hover:text-white transition-colors">
                      {sim.title || sim.summary}
                    </div>
                    <div className="text-[10px] text-[#94a3b8] line-clamp-2">
                      {sim.summary}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
