export interface Ad {
  id: string; // Unique ID for the ad instance (client-side)
  network: string;
  size: string; // e.g., "300x250"
  domPath: string; // CSS selector path
  isIframe: boolean;
  iframeOrigin?: string; // URL of iframe if isIframe is true
}

export interface Scan {
  id: string; // Unique ID for the scan
  tabId: number;
  url: string;
  timestamp: number; // Unix timestamp
  adCount: number;
  ads: Ad[];
}

export interface AdDetectionSignature {
  id: string; // Unique ID for the signature
  network: string;
  selector: string; // CSS selector
}

export type ScanDepth = "top-level-only" | "include-same-origin-iframes" | "include-open-shadow-roots";

export interface ExtensionOptions {
  detectionSignatures: AdDetectionSignature[];
  scanDepth: ScanDepth;
}

// Chrome storage keys
export const STORAGE_KEY_OPTIONS = 'adscope_options';
export const STORAGE_KEY_SCANS = 'adscope_scans';
export const STORAGE_KEY_LAST_SCAN_ID = 'adscope_last_scan_id'; // To store last scan ID per tab
