import React from 'react';
import { SearchResultItem } from '../types';
import { AdCard } from './AdCard';
import { EmptyState } from './EmptyState';

interface AdGridProps {
  items: SearchResultItem[];
  isLoading: boolean;
  onSelectAd: (item: SearchResultItem) => void;
  debugMode: boolean;
  onResetFilters: () => void;
  totalResults: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  selectedAdIds?: Set<string>;
  onToggleSelect?: (adId: string) => void;
  likedAdIds?: Set<string>;
  onToggleLike?: (adId: string) => void;
  savedAdIds?: Set<string>;
  onOpenSaveToGroup?: (adId: string) => void;
}

export const AdGrid: React.FC<AdGridProps> = ({
  items,
  isLoading,
  onSelectAd,
  debugMode,
  onResetFilters,
  totalResults,
  onLoadMore,
  hasMore,
  selectedAdIds,
  onToggleSelect,
  likedAdIds,
  onToggleLike,
  savedAdIds,
  onOpenSaveToGroup
}) => {
  if (isLoading && items.length === 0) {
    return (
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="bg-[#13151a] rounded-[20px] border border-[#222630] p-3.5 space-y-3 animate-pulse"
          >
            <div className="w-full aspect-[16/10] bg-[#0a0b0e] border border-[#222630] rounded-[14px]"></div>
            <div className="flex items-center gap-2 pt-1">
              <div className="w-6 h-6 rounded-full bg-[#222630]"></div>
              <div className="h-3.5 bg-[#222630] rounded w-1/3"></div>
            </div>
            <div className="h-4 bg-[#222630] rounded w-4/5"></div>
            <div className="h-3 bg-[#1c1f26] rounded w-2/3"></div>
            <div className="flex gap-2 pt-2">
              <div className="h-5 bg-[#222630] rounded-full w-16"></div>
              <div className="h-5 bg-[#222630] rounded-full w-20"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!isLoading && items.length === 0) {
    return <EmptyState onReset={onResetFilters} />;
  }

  return (
    <div className="p-6 space-y-8">
      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
        {items.map((item) => (
          <AdCard
            key={item.ad.id}
            item={item}
            onSelect={() => onSelectAd(item)}
            debugMode={debugMode}
            isSelected={selectedAdIds?.has(item.ad.id)}
            onToggleSelect={onToggleSelect}
            isLiked={likedAdIds?.has(item.ad.id)}
            onToggleLike={onToggleLike}
            isSaved={savedAdIds?.has(item.ad.id)}
            onOpenSaveToGroup={onOpenSaveToGroup}
          />
        ))}
      </div>

      {/* Pagination / Load More */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-4 pb-8">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-dark-200 hover:text-white font-medium text-xs border border-dark-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {isLoading ? 'Loading more ads...' : 'Load More Advertisements'}
          </button>
        </div>
      )}
    </div>
  );
};
