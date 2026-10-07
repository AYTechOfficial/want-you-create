"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Ad, Scan, ExtensionOptions } from '../../types';
import {
  isChromeExtension,
  getOptions,
  getScans,
  setScans,
  getLastScanIdForTab,
  setLastScanIdForTab,
  injectAndRunContentScript,
  sendMessageToActiveTab,
  removeHighlightInTab
} from '../../lib/chrome';
import { AdItem } from '../../components/AdItem';

export default function SidePanelPage() {
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null);
  const [currentScan, setCurrentScan] = useState<Scan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedAdId, setHighlightedAdId] = useState<string | null>(null);
  const [extensionOptions, setExtensionOptions] = useState<ExtensionOptions | null>(null);
  const [isTabReady, setIsTabReady] = useState(false); // To check if tab is loaded enough to scan

  const fetchCurrentTab = useCallback(async () => {
    if (!isChromeExtension) return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      setCurrentTab(tab || null);
      if (tab?.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && tab.status === 'complete') {
        setIsTabReady(true);
      } else {
        setIsTabReady(false);
      }
    } catch (e) {
      console.error("AdScope: Failed to get current tab:", e);
      setCurrentTab(null);
      setIsTabReady(false);
    }
  }, []);

  const loadLastScanForCurrentTab = useCallback(async (tabId: number, tabUrl: string) => {
    if (!isChromeExtension) return;
    const allScans = await getScans();
    const lastScanId = await getLastScanIdForTab(tabId);

    if (lastScanId) {
      const scan = allScans.find(s => s.id === lastScanId && s.tabId === tabId && s.url === tabUrl);
      if (scan) {
        setCurrentScan(scan);
        setError(null);
        return;
      }
    }
    setCurrentScan(null); // Clear if no valid last scan
    setError(null);
  }, []);

  const runScan = useCallback(async () => {
    if (!isChromeExtension || !currentTab?.id || !currentTab.url || !extensionOptions) {
      setError("Cannot run scan: No active tab, invalid URL, or options not loaded.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setHighlightedAdId(null); // Clear highlight on new scan

    try {
      await removeHighlightInTab(currentTab.id); // Ensure any existing highlight is removed

      const response = await injectAndRunContentScript(currentTab.id, extensionOptions);

      if (response && response.success) {
        const newScanId = Math.random().toString(36).substring(2, 11);
        const newScan: Scan = {
          id: newScanId,
          tabId: currentTab.id,
          url: currentTab.url,
          timestamp: Date.now(),
          adCount: response.ads.length,
          ads: response.ads,
        };

        const allScans = await getScans();
        // Filter out previous scans for this tab, then add the new one
        const updatedScans = [...allScans.filter(s => s.tabId !== currentTab.id), newScan];
        await setScans(updatedScans);
        await setLastScanIdForTab(currentTab.id, newScanId);

        setCurrentScan(newScan);
      } else {
        setError(response?.error || "Scan failed. Please try again.");
        setCurrentScan(null);
      }
    } catch (e: any) {
      console.error("AdScope: Scan execution error:", e);
      setError(`Scan failed: ${e.message || "Unknown error."}`);
      setCurrentScan(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentTab, extensionOptions]);

  const handleToggleHighlight = useCallback(async (adId: string, domPath: string) => {
    if (!isChromeExtension || !currentTab?.id) return;

    if (highlightedAdId === adId) {
      // Ad is already highlighted, remove it
      await sendMessageToActiveTab('removeHighlight');
      setHighlightedAdId(null);
    } else {
      // Highlight new ad, remove previous if any
      await sendMessageToActiveTab('removeHighlight'); // Ensure previous is cleared
      await sendMessageToActiveTab('highlightAd', { selector: domPath });
      setHighlightedAdId(adId);
    }
  }, [currentTab, highlightedAdId]);

  useEffect(() => {
    if (!isChromeExtension) {
      setError("AdScope is not running in a Chrome extension environment.");
      return;
    }

    const init = async () => {
      await fetchCurrentTab();
      const options = await getOptions();
      setExtensionOptions(options);
    };
    init();

    const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      fetchCurrentTab();
      setHighlightedAdId(null); // Clear highlight on tab switch
    };

    const handleTabUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (tabId === currentTab?.id && changeInfo.url && tab.url !== currentTab.url) {
        fetchCurrentTab(); // Re-fetch tab info to get new URL and status
        setCurrentScan(null); // Clear scan results on URL change
        setLastScanIdForTab(tabId, null); // Clear last scan ID for this tab
        setHighlightedAdId(null); // Clear highlight
      } else if (tabId === currentTab?.id && changeInfo.status === 'complete') {
        // If tab status changes to complete, re-evaluate isTabReady and load last scan
        fetchCurrentTab();
      }
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, [fetchCurrentTab, currentTab?.id, currentTab?.url]); // currentTab.id and url in dependency array to react to tab changes

  useEffect(() => {
    if (currentTab?.id && currentTab.url && isTabReady) {
      loadLastScanForCurrentTab(currentTab.id, currentTab.url);
    } else {
      setCurrentScan(null);
    }
  }, [currentTab, isTabReady, loadLastScanForCurrentTab]);

  const renderContent = () => {
    if (!isChromeExtension) {
      return <p className="text-red-400 text-center p-4">This page is intended for use within a Chrome extension.</p>;
    }

    if (!isTabReady) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <p className="text-[#e6e9ef] text-lg mb-4">Navigate to a webpage to scan.</p>
          <p className="text-[#6B7280] text-sm">AdScope needs an active, loaded webpage to function.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <p className="text-red-400 text-lg mb-4">Error: {error}</p>
          <button
            onClick={runScan}
            className="bg-[#4f8cff] hover:bg-[#3a70e0] text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
          >
            Try Scan Again
          </button>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4f8cff]"></div>
          <p className="text-[#e6e9ef] mt-4">Scanning for ads...</p>
        </div>
      );
    }

    if (!currentScan || currentScan.adCount === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <p className="text-[#e6e9ef] text-lg mb-4">No scan results yet.</p>
          <p className="text-[#6B7280] text-sm mb-6">Click 'Run Scan' to begin.</p>
          <button
            onClick={runScan}
            className="bg-[#4f8cff] hover:bg-[#3a70e0] text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
          >
            Run Scan
          </button>
        </div>
      );
    }

    return (
      <div className="p-4">
        <p className="text-[#6B7280] text-sm mb-2">Detected {currentScan.adCount} ads on this page.</p>
        <div className="space-y-2">
          {currentScan.ads.map((ad) => (
            <AdItem
              key={ad.id}
              ad={ad}
              tabId={currentTab?.id!}
              isHighlighted={highlightedAdId === ad.id}
              onToggleHighlight={handleToggleHighlight}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0d10] text-[#e6e9ef] font-sans flex flex-col">
      <header className="bg-[#14171c] p-4 border-b border-[#E5E7EB] flex items-center justify-between">
        <h1 className="text-lg font-bold">AdScope</h1>
        <button
          onClick={runScan}
          disabled={isLoading || !isTabReady}
          className={`py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 \
            ${isLoading || !isTabReady ? 'bg-gray-600 cursor-not-allowed' : 'bg-[#4f8cff] hover:bg-[#3a70e0] text-white'}`}
        >
          {isLoading ? 'Scanning...' : 'Run Scan'}
        </button>
      </header>
      <main className="flex-1 overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
}
