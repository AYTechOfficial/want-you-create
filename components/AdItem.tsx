"use client";

import React, { useState } from 'react';
import { Ad } from '../types';

interface AdItemProps {
  ad: Ad;
  tabId: number;
  isHighlighted: boolean;
  onToggleHighlight: (adId: string, domPath: string) => void;
}

export function AdItem({ ad, tabId, isHighlighted, onToggleHighlight }: AdItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleHighlightClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling expansion
    onToggleHighlight(ad.id, ad.domPath);
  };

  return (
    <div className="bg-[#14171c] rounded-md mb-2 border border-[#E5E7EB] cursor-pointer" onClick={handleToggleExpand}>
      <div className="p-3 flex justify-between items-center">
        <div className="flex-1">
          <p className="text-[#e6e9ef] font-medium text-sm">{ad.network}</p>
          <p className="text-[#6B7280] text-xs font-mono">{ad.size}</p>
        </div>
        <svg
          className={`w-4 h-4 text-[#e6e9ef] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>

      {isExpanded && (
        <div className="border-t border-[#E5E7EB] p-3 text-xs space-y-2">
          <div>
            <p className="text-[#6B7280]">Network:</p>
            <p className="text-[#e6e9ef] font-mono break-all">{ad.network}</p>
          </div>
          <div>
            <p className="text-[#6B7280]">Size:</p>
            <p className="text-[#e6e9ef] font-mono">{ad.size}</p>
          </div>
          <div>
            <p className="text-[#6B7280]">DOM Path:</p>
            <p className="text-[#e6e9ef] font-mono break-all">{ad.domPath}</p>
          </div>
          <div>
            <p className="text-[#6B7280]">Source:</p>
            <p className="text-[#e6e9ef] font-mono break-all">
              {ad.isIframe ? `Iframe: ${ad.iframeOrigin || 'Unknown'}` : 'Top-level DOM'}
            </p>
          </div>
          <button
            onClick={handleHighlightClick}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 \
              ${isHighlighted ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#4f8cff] hover:bg-[#3a70e0] text-white'}`}
          >
            {isHighlighted ? 'Remove Highlight' : 'Highlight'}
          </button>
        </div>
      )}
    </div>
  );
}
