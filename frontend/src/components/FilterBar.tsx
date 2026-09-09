import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';
import { AggregatedFilters, FilterState } from '../types';

interface FilterBarProps {
  filters: AggregatedFilters | null;
  state: FilterState;
  onChange: (newState: Partial<FilterState>) => void;
  totalResults: number;
  tookMs?: number;
  isSearching: boolean;
  isAllSelected?: boolean;
  isSomeSelected?: boolean;
  selectedCount?: number;
  onToggleSelectAll?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  state,
  onChange,
  totalResults,
  tookMs,
  isAllSelected = false,
  isSomeSelected = false,
  selectedCount = 0,
  onToggleSelectAll,
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [brandSearch, setBrandSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
    setBrandSearch('');
  };

  const handleToggleBrand = (brandName: string) => {
    const next = state.brands.includes(brandName)
      ? state.brands.filter(b => b !== brandName)
      : [...state.brands, brandName];
    onChange({ brands: next, page: 1 });
  };

  const handleTogglePlatform = (platformName: string) => {
    const next = state.platforms.includes(platformName)
      ? state.platforms.filter(p => p !== platformName)
      : [...state.platforms, platformName];
    onChange({ platforms: next, page: 1 });
  };

  const handleToggleCreativeType = (type: string) => {
    const next = state.creativeTypes.includes(type)
      ? state.creativeTypes.filter(t => t !== type)
      : [...state.creativeTypes, type];
    onChange({ creativeTypes: next, page: 1 });
  };

  const handleToggleCategory = (cat: string) => {
    const next = state.categories.includes(cat)
      ? state.categories.filter(c => c !== cat)
      : [...state.categories, cat];
    onChange({ categories: next, page: 1 });
  };

  const handleSelectSort = (sortVal: FilterState['sort']) => {
    onChange({ sort: sortVal, page: 1 });
    setOpenDropdown(null);
  };

  const handleClearAll = () => {
    onChange({
      brands: [],
      platforms: [],
      creativeTypes: [],
      categories: [],
      topics: [],
      hashtags: [],
      sort: 'relevant',
      page: 1
    });
  };

  const hasActiveFilters =
    state.brands.length > 0 ||
    state.platforms.length > 0 ||
    state.creativeTypes.length > 0 ||
    state.categories.length > 0 ||
    state.topics.length > 0 ||
    state.hashtags.length > 0;

  const filteredBrands = (filters?.brands || []).filter(b =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const sortLabels: Record<string, string> = {
    relevant: 'Most Relevant',
    newest: 'Newest First',
    oldest: 'Oldest First',
    brand_asc: 'Brand (A-Z)',
    brand_desc: 'Brand (Z-A)'
  };

  return (
    <div className="border-b border-[#222630] bg-[#0a0b0e] px-6 py-3 space-y-3 select-none" ref={dropdownRef}>
      {/* Top Filter Buttons Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Select All Checkbox Button */}
          <button
            onClick={onToggleSelectAll}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isAllSelected
                ? 'bg-[#0e261a] text-[#2fe593] border-[#2fe593]'
                : isSomeSelected
                ? 'bg-[#13151a] text-white border-[#2fe593]'
                : 'bg-[#0f1115] text-[#94a3b8] border-[#222630] hover:border-[#2d3340] hover:text-white'
            }`}
            title={isAllSelected ? 'Deselect all visible ads' : 'Select all visible ads'}
          >
            <div
              className={`w-4 h-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${
                isAllSelected || isSomeSelected
                  ? 'bg-[#10b981] border-[#10b981] text-[#031a0f]'
                  : 'border-[#384052] bg-[#13151a]'
              }`}
            >
              {isAllSelected && <Check className="w-3 h-3 stroke-[3]" />}
              {!isAllSelected && isSomeSelected && (
                <div className="w-2 h-0.5 bg-[#031a0f] rounded-full" />
              )}
            </div>
            <span>Select all</span>
            {selectedCount > 0 && (
              <span className="text-[10px] font-mono font-bold bg-[#10b981] text-[#031a0f] px-1.5 py-0.2 rounded-full">
                {selectedCount}
              </span>
            )}
          </button>

          {/* 1. Brand Dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('brand')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                state.brands.length > 0
                  ? 'bg-[#0e261a] text-[#2fe593] border-[#2fe593]'
                  : 'bg-[#0f1115] text-[#cbd5e1] border-[#222630] hover:border-[#2d3340] hover:text-white'
              }`}
            >
              <span>Brand</span>
              {state.brands.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#10b981] text-[#031a0f] flex items-center justify-center text-[10px] font-bold">
                  {state.brands.length}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-[#64748b]" />
            </button>

            {openDropdown === 'brand' && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-[#0f1115] border border-[#222630] rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <input
                  type="text"
                  placeholder="Search brands..."
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  className="w-full px-2.5 py-1.5 mb-2 rounded-lg bg-[#0a0b0e] border border-[#222630] text-xs text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#2fe593]"
                />
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {filteredBrands.map((b) => {
                    const isSelected = state.brands.includes(b.name);
                    return (
                      <button
                        key={b.name}
                        onClick={() => handleToggleBrand(b.name)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          isSelected ? 'bg-[#0e261a] text-[#2fe593] font-bold' : 'text-[#cbd5e1] hover:bg-[#181b21] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <div className={`w-4 h-4 rounded-md flex-shrink-0 flex items-center justify-center border transition-colors ${isSelected ? 'bg-[#10b981] border-[#10b981] text-[#031a0f]' : 'border-[#384052] bg-[#0a0b0e]'}`}>
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="truncate">{b.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748b] ml-2 flex-shrink-0">{b.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Platform Dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('platform')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                state.platforms.length > 0
                  ? 'bg-[#0e261a] text-[#2fe593] border-[#2fe593]'
                  : 'bg-[#0f1115] text-[#cbd5e1] border-[#222630] hover:border-[#2d3340] hover:text-white'
              }`}
            >
              <span>Platform</span>
              {state.platforms.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#10b981] text-[#031a0f] flex items-center justify-center text-[10px] font-bold">
                  {state.platforms.length}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-[#64748b]" />
            </button>

            {openDropdown === 'platform' && (
              <div className="absolute left-0 top-full mt-1.5 w-60 bg-[#0f1115] border border-[#222630] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="space-y-0.5">
                  {(filters?.platforms || []).map((p) => {
                    const isSelected = state.platforms.includes(p.name);
                    return (
                      <button
                        key={p.name}
                        onClick={() => handleTogglePlatform(p.name)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          isSelected ? 'bg-[#0e261a] text-[#2fe593] font-bold' : 'text-[#cbd5e1] hover:bg-[#181b21] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <div className={`w-4 h-4 rounded-md flex-shrink-0 flex items-center justify-center border transition-colors ${isSelected ? 'bg-[#10b981] border-[#10b981] text-[#031a0f]' : 'border-[#384052] bg-[#0a0b0e]'}`}>
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="truncate">{p.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748b] ml-2 flex-shrink-0">{p.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. Creative Type Dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('creativeType')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                state.creativeTypes.length > 0
                  ? 'bg-[#0e261a] text-[#2fe593] border-[#2fe593] shadow-sm shadow-[#10b981]/20'
                  : 'bg-[#0f1115] text-[#cbd5e1] border-[#222630] hover:border-[#2d3340] hover:text-white'
              }`}
            >
              <span>Creative Type</span>
              {state.creativeTypes.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#10b981] text-[#031a0f] flex items-center justify-center text-[10px] font-extrabold">
                  {state.creativeTypes.length}
                </span>
              )}
              {state.creativeTypes.length > 0 ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange({ creativeTypes: [], page: 1 });
                  }}
                  className="hover:text-white p-0.5 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#64748b]" />
              )}
            </button>

            {openDropdown === 'creativeType' && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-[#0f1115] border border-[#222630] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="space-y-0.5">
                  {(filters?.creativeTypes || []).map((t) => {
                    const isSelected = state.creativeTypes.includes(t.name);
                    return (
                      <button
                        key={t.name}
                        onClick={() => handleToggleCreativeType(t.name)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          isSelected ? 'bg-[#0e261a] text-[#2fe593] font-bold' : 'text-[#cbd5e1] hover:bg-[#181b21] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <div className={`w-4 h-4 rounded-md flex-shrink-0 flex items-center justify-center border transition-colors ${isSelected ? 'bg-[#10b981] border-[#10b981] text-[#031a0f]' : 'border-[#384052] bg-[#0a0b0e]'}`}>
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="truncate">{t.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748b] ml-2 flex-shrink-0">{t.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results Counter */}
        <div className="text-xs text-[#94a3b8] font-normal flex items-center gap-1.5">
          <span className="text-white font-bold">{totalResults.toLocaleString()}</span>
          <span>{totalResults === 1 ? 'ad' : 'ads'} found</span>
          {tookMs !== undefined && (
            <span className="text-[11px] font-mono text-[#64748b]">({tookMs}ms)</span>
          )}
        </div>
      </div>

      {/* Active Filter Chips Row (Matches reference Active: [Video Ad x] [Document Ad x] Clear All) */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-[#94a3b8] font-medium mr-1">Active:</span>

          {state.platforms.map((p) => (
            <span
              key={`p-${p}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-[#0e261a] text-[#2fe593] border border-[#184530]"
            >
              <span>{p}</span>
              <button
                onClick={() => handleTogglePlatform(p)}
                className="hover:text-white p-0.5 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {state.brands.map((b) => (
            <span
              key={`b-${b}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-[#0e261a] text-[#2fe593] border border-[#184530]"
            >
              <span>{b}</span>
              <button
                onClick={() => handleToggleBrand(b)}
                className="hover:text-white p-0.5 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {state.creativeTypes.map((t) => (
            <span
              key={`t-${t}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-[#0e261a] text-[#2fe593] border border-[#184530]"
            >
              <span>{t}</span>
              <button
                onClick={() => handleToggleCreativeType(t)}
                className="hover:text-white p-0.5 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {state.categories.map((c) => (
            <span
              key={`c-${c}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-[#0e261a] text-[#2fe593] border border-[#184530]"
            >
              <span>{c}</span>
              <button
                onClick={() => handleToggleCategory(c)}
                className="hover:text-white p-0.5 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          <button
            onClick={handleClearAll}
            className="text-xs text-[#2fe593] hover:underline font-semibold transition-colors ml-1"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};
