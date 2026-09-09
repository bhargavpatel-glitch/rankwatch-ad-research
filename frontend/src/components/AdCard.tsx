import React, { useState } from 'react';
import { ExternalLink, Heart, Bookmark, Check, CheckCircle2, ArrowRight } from 'lucide-react';
import { SearchResultItem } from '../types';
import { AdCreativeMedia } from './AdCreativeMedia';
import { getBrandLogo } from '../utils/brandLogos';
import { PlatformIcon } from './PlatformIcon';

interface AdCardProps {
  item: SearchResultItem;
  onSelect: () => void;
  debugMode: boolean;
  isSelected?: boolean;
  onToggleSelect?: (adId: string) => void;
  isLiked?: boolean;
  onToggleLike?: (adId: string) => void;
  isSaved?: boolean;
  onOpenSaveToGroup?: (adId: string) => void;
}

export const AdCard: React.FC<AdCardProps> = ({
  item,
  onSelect,
  debugMode,
  isSelected = false,
  onToggleSelect,
  isLiked = false,
  onToggleLike,
  isSaved = false,
  onOpenSaveToGroup
}) => {
  const { ad, score, explanation } = item;
  const [logoError, setLogoError] = useState(false);

  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col w-full rounded-[20px] bg-[#13151a] p-3.5 border transition-all duration-300 ease-out cursor-pointer hover:-translate-y-1 ${
        isSelected
          ? 'border-[#2fe593] ring-2 ring-[#2fe593]/30 shadow-[0_0_24px_rgba(47,229,147,0.18)]'
          : 'border-[#222630] hover:border-[#2d3340] shadow-[0_10px_25px_-10px_rgba(0,0,0,0.7)] hover:shadow-[0_16px_32px_-10px_rgba(0,0,0,0.9)]'
      }`}
      style={{
        boxShadow: isSelected ? undefined : 'inset 0 1px 0 0 rgba(255, 255, 255, 0.04)'
      }}
    >
      {/* 1. Nested Framed Media Box */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[14px] bg-[#0a0b0e] border border-[#222630] flex items-center justify-center">
        {/* Media (Video, Image, or Document Placeholder) */}
        <AdCreativeMedia ad={ad} aspectRatio="aspect-full" />

        {/* Selection Checkbox (Top-Left) - Clearly visible and interactive */}
        <div className="absolute top-2.5 left-2.5 z-20 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(ad.id);
            }}
            className={`w-6 h-6 rounded-lg flex items-center justify-center backdrop-blur-md transition-all ${
              isSelected
                ? 'bg-[#10b981] border border-[#2fe593] text-[#031a0f] shadow-md shadow-emerald-600/30'
                : 'bg-black/60 border border-white/25 text-transparent hover:text-white/60 hover:border-white/50'
            }`}
            title={isSelected ? 'Deselect ad' : 'Select ad'}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </button>
        </div>

        {/* Floating Action Cluster: Heart & Bookmark (Top-Right) */}
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 pointer-events-auto">
          {/* Heart / Like Button - Fills GREEN when liked */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike?.(ad.id);
            }}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all shadow-md ${
              isLiked
                ? 'bg-[#0e261a] border-[#2fe593] text-[#2fe593] shadow-emerald-500/20 scale-105'
                : 'bg-black/55 border-white/15 text-white/80 hover:text-white hover:bg-black/80 hover:scale-105'
            }`}
            title={isLiked ? 'Remove from liked videos' : 'Save to liked videos'}
          >
            <Heart className={`w-3.5 h-3.5 transition-all ${isLiked ? 'fill-[#2fe593] text-[#2fe593]' : ''}`} />
          </button>

          {/* Bookmark / Save to Group Button - Fills GREEN when active/saved */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSaveToGroup?.(ad.id);
            }}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all shadow-md ${
              isSaved
                ? 'bg-[#0e261a] border-[#2fe593] text-[#2fe593] shadow-emerald-500/20 scale-105'
                : 'bg-black/55 border-white/15 text-white/80 hover:text-white hover:bg-black/80 hover:scale-105'
            }`}
            title="Save to custom group..."
          >
            <Bookmark className={`w-3.5 h-3.5 transition-all ${isSaved ? 'fill-[#2fe593] text-[#2fe593]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Content Body */}
      <div className="pt-3 px-1 pb-0.5 flex flex-col flex-1 justify-between space-y-2.5">
        <div className="space-y-2">
          {/* Brand Identity Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              {/* Brand Logo Avatar */}
              <div className="w-6 h-6 rounded-full bg-black border border-[#222630] p-0.5 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                {!logoError ? (
                  <img
                    src={getBrandLogo(ad.brand)}
                    alt={ad.brand}
                    onError={() => setLogoError(true)}
                    className="w-full h-full object-contain rounded-full"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-[#2fe593]">
                    {ad.brand.charAt(0)}
                  </span>
                )}
              </div>

              {/* Brand Name */}
              <span className="font-bold text-xs text-white tracking-tight truncate">
                {ad.brand}
              </span>

              {/* Verified Badge */}
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] fill-[#10b981]/20 flex-shrink-0" />
            </div>

            {/* Platform Icon (Right-Aligned) - Shows Google, Meta, Instagram, LinkedIn */}
            <div className="flex items-center justify-end flex-shrink-0" title={`Platform: ${ad.platform}`}>
              <PlatformIcon platform={ad.platform} className="w-4 h-4" />
            </div>
          </div>

          {/* Bold Hook / Headline */}
          <h3 className="font-bold text-[13.5px] text-white leading-snug line-clamp-2 group-hover:text-[#2fe593] transition-colors">
            {ad.title || ad.summary}
          </h3>

          {/* Ad Copy Snippet (Muted 2-line preview) */}
          <p className="text-[11.5px] text-[#94a3b8] leading-relaxed line-clamp-2">
            {ad.adCopy || ad.summary || ad.title}
          </p>
        </div>

        {/* 3. Footer Actions */}
        <div className="pt-2.5 border-t border-[#222630] space-y-2">
          {/* Debug Inspector Pill (if active) */}
          {debugMode && explanation && (
            <div className="bg-[#0a0b0e] border border-[#222630] rounded-xl p-1.5 text-[10px] text-[#2fe593] font-mono flex items-center justify-between">
              <span>Score: <b>{Math.round(score)}</b></span>
              <span className="truncate max-w-[130px]">{explanation.explanationNote}</span>
            </div>
          )}

          {/* Bottom Action Row */}
          <div className="flex items-center justify-between">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className="group/inspect text-[11.5px] font-semibold text-[#2fe593] hover:text-[#5df0ab] flex items-center gap-1.5 transition-colors"
            >
              <span>Inspect Details</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/inspect:translate-x-1" />
            </button>

            {ad.sourceAdUrl && (
              <a
                href={ad.sourceAdUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[#64748b] hover:text-[#2fe593] p-1 rounded transition-colors"
                title="Open original ad source"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
