"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AdDetectionSignature, ScanDepth, ExtensionOptions } from '../../types';
import { getOptions, setOptions, isChromeExtension } from '../../lib/chrome';

export default function OptionsPage() {
  const [detectionSignatures, setDetectionSignatures] = useState<AdDetectionSignature[]>([]);
  const [scanDepth, setScanDepth] = useState<ScanDepth>('top-level-only');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!isChromeExtension) {
      setSaveStatus('error');
      return;
    }
    const loadOptions = async () => {
      const options = await getOptions();
      setDetectionSignatures(options.detectionSignatures);
      setScanDepth(options.scanDepth);
    };
    loadOptions();
  }, []);

  const handleAddSignature = useCallback(() => {
    setDetectionSignatures(prev => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 11), network: '', selector: '' }
    ]);
  }, []);

  const handleUpdateSignature = useCallback((id: string, field: 'network' | 'selector', value: string) => {
    setDetectionSignatures(prev =>
      prev.map(sig => (sig.id === id ? { ...sig, [field]: value } : sig))
    );
  }, []);

  const handleRemoveSignature = useCallback((id: string) => {
    setDetectionSignatures(prev => prev.filter(sig => sig.id !== id));
  }, []);

  const handleSaveOptions = useCallback(async () => {
    if (!isChromeExtension) {
      setSaveStatus('error');
      return;
    }
    setSaveStatus('saving');
    try {
      const options: ExtensionOptions = {
        detectionSignatures: detectionSignatures.filter(sig => sig.network && sig.selector), // Only save valid ones
        scanDepth,
      };
      await setOptions(options);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error("AdScope: Failed to save options:", e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [detectionSignatures, scanDepth]);

  return (
    <div className="min-h-screen bg-[#0b0d10] text-[#e6e9ef] font-sans flex flex-col">
      <header className="bg-[#14171c] p-4 border-b border-[#E5E7EB]">
        <h1 className="text-lg font-bold">AdScope Options</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {!isChromeExtension && (
          <div className="bg-red-900 text-red-100 p-3 rounded-md text-sm">
            This page is intended for use within a Chrome extension. Options will not persist outside of it.
          </div>
        )}

        <section>
          <h2 className="text-md font-semibold mb-3 text-[#e6e9ef]">Detection Signatures</h2>
          <p className="text-[#6B7280] text-sm mb-4">Define CSS selectors to identify ad slots and their associated networks. Only entries with both a network and a selector will be saved.</p>
          <div className="space-y-3">
            {detectionSignatures.map((sig) => (
              <div key={sig.id} className="bg-[#14171c] p-3 rounded-md border border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="Ad Network (e.g., Google AdSense)"
                  value={sig.network}
                  onChange={(e) => handleUpdateSignature(sig.id, 'network', e.target.value)}
                  className="flex-1 p-2 rounded-md bg-[#0b0d10] border border-[#6B7280] text-[#e6e9ef] text-sm focus:outline-none focus:ring-1 focus:ring-[#4f8cff]"
                />
                <input
                  type="text"
                  placeholder="CSS Selector (e.g., ins.adsbygoogle)"
                  value={sig.selector}
                  onChange={(e) => handleUpdateSignature(sig.id, 'selector', e.target.value)}
                  className="flex-1 p-2 rounded-md bg-[#0b0d10] border border-[#6B7280] text-[#e6e9ef] text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#4f8cff]"
                />
                <button
                  onClick={() => handleRemoveSignature(sig.id)}
                  className="bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-md text-sm font-medium transition-colors duration-200"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleAddSignature}
            className="mt-4 bg-[#4f8cff] hover:bg-[#3a70e0] text-white py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200"
          >
            Add New Signature
          </button>
        </section>

        <section>
          <h2 className="text-md font-semibold mb-3 text-[#e6e9ef]">Scan Depth</h2>
          <p className="text-[#6B7280] text-sm mb-4">Configure how deeply AdScope scans the page for ads.</p>
          <div className="space-y-2">
            <label className="flex items-center text-[#e6e9ef] cursor-pointer">
              <input
                type="radio"
                name="scanDepth"
                value="top-level-only"
                checked={scanDepth === 'top-level-only'}
                onChange={() => setScanDepth('top-level-only')}
                className="form-radio h-4 w-4 text-[#4f8cff] bg-[#0b0d10] border-[#6B7280] focus:ring-[#4f8cff]"
              />
              <span className="ml-2 text-sm">Top-level only (fastest, default)</span>
            </label>
            <label className="flex items-center text-[#e6e9ef] cursor-pointer">
              <input
                type="radio"
                name="scanDepth"
                value="include-same-origin-iframes"
                checked={scanDepth === 'include-same-origin-iframes'}
                onChange={() => setScanDepth('include-same-origin-iframes')}
                className="form-radio h-4 w-4 text-[#4f8cff] bg-[#0b0d10] border-[#6B7280] focus:ring-[#4f8cff]"
              />
              <span className="ml-2 text-sm">Include same-origin iframes (balanced)</span>
            </label>
            <label className="flex items-center text-[#e6e9ef] cursor-pointer">
              <input
                type="radio"
                name="scanDepth"
                value="include-open-shadow-roots"
                checked={scanDepth === 'include-open-shadow-roots'}
                onChange={() => setScanDepth('include-open-shadow-roots')}
                className="form-radio h-4 w-4 text-[#4f8cff] bg-[#0b0d10] border-[#6B7280] focus:ring-[#4f8cff]"
              />
              <span className="ml-2 text-sm">Include open shadow roots (most comprehensive, may be slower)</span>
            </label>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          {saveStatus === 'saving' && <p className="text-[#4f8cff] text-sm">Saving...</p>}
          {saveStatus === 'saved' && <p className="text-green-500 text-sm">Options saved!</p>}
          {saveStatus === 'error' && <p className="text-red-500 text-sm">Failed to save options.</p>}
          <button
            onClick={handleSaveOptions}
            disabled={saveStatus === 'saving'}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 \
              ${saveStatus === 'saving' ? 'bg-gray-600 cursor-not-allowed' : 'bg-[#4f8cff] hover:bg-[#3a70e0] text-white'}`}
          >
            Save Changes
          </button>
        </div>
      </main>
    </div>
  );
}
