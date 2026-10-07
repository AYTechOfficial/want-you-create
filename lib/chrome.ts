import { Ad, Scan, ExtensionOptions, STORAGE_KEY_OPTIONS, STORAGE_KEY_SCANS, STORAGE_KEY_LAST_SCAN_ID } from '../types';

export const isChromeExtension = typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';

// --- Storage Utilities ---
export async function getOptions(): Promise<ExtensionOptions> {
  if (!isChromeExtension) {
    return {
      detectionSignatures: [
        { id: 'default-1', network: 'Google AdSense', selector: 'ins.adsbygoogle' },
        { id: 'default-2', network: 'Google AdSense', selector: 'div[id^="google_ads_iframe"]' },
        { id: 'default-3', network: 'Google Ad Manager', selector: 'div[id^="div-gpt-ad"]' },
        { id: 'default-4', network: 'Generic Iframe Ad', selector: 'iframe[width][height][src*="ad"]' },
      ],
      scanDepth: 'top-level-only',
    };
  }
  const result = await chrome.storage.local.get(STORAGE_KEY_OPTIONS);
  return result[STORAGE_KEY_OPTIONS] || {
    detectionSignatures: [
      { id: 'default-1', network: 'Google AdSense', selector: 'ins.adsbygoogle' },
      { id: 'default-2', network: 'Google AdSense', selector: 'div[id^="google_ads_iframe"]' },
      { id: 'default-3', network: 'Google Ad Manager', selector: 'div[id^="div-gpt-ad"]' },
      { id: 'default-4', network: 'Generic Iframe Ad', selector: 'iframe[width][height][src*="ad"]' },
    ],
    scanDepth: 'top-level-only',
  };
}

export async function setOptions(options: ExtensionOptions): Promise<void> {
  if (!isChromeExtension) return;
  await chrome.storage.local.set({ [STORAGE_KEY_OPTIONS]: options });
}

export async function getScans(): Promise<Scan[]> {
  if (!isChromeExtension) return [];
  const result = await chrome.storage.local.get(STORAGE_KEY_SCANS);
  return result[STORAGE_KEY_SCANS] || [];
}

export async function setScans(scans: Scan[]): Promise<void> {
  if (!isChromeExtension) return;
  await chrome.storage.local.set({ [STORAGE_KEY_SCANS]: scans });
}

export async function getLastScanIdForTab(tabId: number): Promise<string | null> {
  if (!isChromeExtension) return null;
  const result = await chrome.storage.local.get(STORAGE_KEY_LAST_SCAN_ID);
  return result[STORAGE_KEY_LAST_SCAN_ID]?.[tabId] || null;
}

export async function setLastScanIdForTab(tabId: number, scanId: string | null): Promise<void> {
  if (!isChromeExtension) return;
  const result = await chrome.storage.local.get(STORAGE_KEY_LAST_SCAN_ID);
  const lastScanIds = result[STORAGE_KEY_LAST_SCAN_ID] || {};
  if (scanId) {
    lastScanIds[tabId] = scanId;
  } else {
    delete lastScanIds[tabId];
  }
  await chrome.storage.local.set({ [STORAGE_KEY_LAST_SCAN_ID]: lastScanIds });
}

// --- Messaging Utilities ---
export async function sendMessageToActiveTab(action: string, payload?: any): Promise<any> {
  if (!isChromeExtension) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    return chrome.tabs.sendMessage(tab.id, { action, ...payload });
  }
  return null;
}

export function onMessageFromContentScript(callback: (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => boolean | undefined) {
  if (!isChromeExtension) return;
  chrome.runtime.onMessage.addListener(callback);
}

export function removeMessageListener(callback: (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => boolean | undefined) {
  if (!isChromeExtension) return;
  chrome.runtime.removeListener(callback);
}

// --- Scripting Utilities ---
// This function will be injected into the content script context.
// It must be self-contained and not rely on closures from the extension's background script.
function contentScriptMain(options: ExtensionOptions) {
  const HIGHLIGHT_CLASS = 'adscope-highlight';
  let currentHighlightedElement = null;

  function getCssSelector(el) {
    if (!(el instanceof Element)) return '';
    const path = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.nodeName.toLowerCase();
      if (current.id) {
        selector += '#' + current.id;
        path.unshift(selector);
        break;
      } else {
        let sibling = current, nth = 1;
        while (sibling.previousElementSibling) {
          if (sibling.previousElementSibling.nodeName.toLowerCase() === selector) {
            nth++;
          }
          sibling = sibling.previousElementSibling;
        }
        if (nth !== 1) {
          selector += `:nth-of-type(${nth})`;
        }
      }
      path.unshift(selector);
      current = current.parentNode;
    }
    return path.join(' > ');
  }

  function scanForAds(options) {
    const ads = [];
    const signatures = options.detectionSignatures || [];
    const scanDepth = options.scanDepth || 'top-level-only';

    function findAdsInDocument(doc, isIframe = false, iframeOrigin = null) {
      signatures.forEach(sig => {
        try {
          doc.querySelectorAll(sig.selector).forEach(el => {
            const rect = el.getBoundingClientRect();
            // Filter out tiny or hidden elements, and elements outside viewport
            if (rect.width > 10 && rect.height > 10 && rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0) {
              ads.push({
                id: Math.random().toString(36).substring(2, 11), // Client-side ID for highlighting
                network: sig.network,
                size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                domPath: getCssSelector(el),
                isIframe: isIframe,
                iframeOrigin: iframeOrigin,
              });
            }
          });
        } catch (e) {
          console.error("AdScope: Error querying selector:", sig.selector, e);
        }
      });

      if (scanDepth !== 'top-level-only') {
        doc.querySelectorAll('iframe').forEach(iframe => {
          try {
            const iframeSrcOrigin = iframe.src ? new URL(iframe.src).origin : null;
            const currentDocOrigin = window.location.origin;

            if (iframe.contentDocument && (scanDepth === 'include-open-shadow-roots' || iframeSrcOrigin === currentDocOrigin)) {
              findAdsInDocument(iframe.contentDocument, true, iframe.src);
            }
          } catch (e) {
            // Cross-origin iframe access denied
            // console.warn("AdScope: Could not access cross-origin iframe:", iframe.src, e);
          }
        });
      }
    }

    findAdsInDocument(document);
    return ads;
  }

  function highlightElement(selector) {
    if (currentHighlightedElement) {
      currentHighlightedElement.classList.remove(HIGHLIGHT_CLASS);
      currentHighlightedElement.style.outline = '';
    }
    const el = document.querySelector(selector);
    if (el) {
      el.classList.add(HIGHLIGHT_CLASS);
      el.style.outline = '2px solid #4f8cff'; // Accent color
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      currentHighlightedElement = el;
    }
  }

  function removeHighlight() {
    if (currentHighlightedElement) {
      currentHighlightedElement.classList.remove(HIGHLIGHT_CLASS);
      currentHighlightedElement.style.outline = '';
      currentHighlightedElement = null;
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scanDOM') {
      removeHighlight(); // Clear any existing highlight before a new scan
      const ads = scanForAds(options); // Use the options passed during injection
      sendResponse({ success: true, ads: ads });
    } else if (request.action === 'highlightAd') {
      highlightElement(request.selector);
      sendResponse({ success: true });
    } else if (request.action === 'removeHighlight') {
      removeHighlight();
      sendResponse({ success: true });
    }
    return true; // Indicates an asynchronous response
  });
}

export async function injectAndRunContentScript(tabId: number, options: ExtensionOptions): Promise<any> {
  if (!isChromeExtension) return;
  try {
    // First, inject the content script function.
    // The `args` array will be passed to `contentScriptMain` as its arguments.
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: contentScriptMain,
      args: [options], // Pass options to the content script
      world: 'ISOLATED',
    });

    // Then, send a message to the injected script to perform the scan.
    // This separation allows the script to be injected once, and then messages
    // can be sent to trigger actions without re-injecting the entire script.
    // The contentScriptMain already sets up the listener.
    // So, we just need to trigger the 'scanDOM' action.
    return await chrome.tabs.sendMessage(tabId, { action: 'scanDOM', options: options });

  } catch (error) {
    console.error("AdScope: Failed to inject or run content script:", error);
    throw error;
  }
}

export async function removeHighlightInTab(tabId: number): Promise<void> {
  if (!isChromeExtension) return;
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'removeHighlight' });
  } catch (error) {
    console.warn("AdScope: Could not remove highlight in tab (might be closed or script not injected):", error);
  }
}
