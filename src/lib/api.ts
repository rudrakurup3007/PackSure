import { ScanResult, BackendHealthResponse } from '../types/inspection';
import { DEFAULT_MOCK_SCAN_RESULT } from '../mock/scanResult';

/**
 * Resolves the backend base URL from environment variables or sensible default.
 */
export function getApiBaseUrl(): string {
  // Support both Next.js style and Vite style environment variables
  const envUrl =
    (import.meta.env?.VITE_API_BASE_URL as string | undefined) ||
    (import.meta.env?.NEXT_PUBLIC_API_BASE_URL as string | undefined) ||
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL);

  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.replace(/\/+$/, '');
  }

  // Production backend fallback on Render
  return 'https://packsure-backend-wlri.onrender.com';
}

/**
 * Checks whether mock mode is enabled via environment variable
 */
export function isMockModeConfigured(): boolean {
  const envMock =
    (import.meta.env?.VITE_USE_MOCK_API as string | boolean | undefined) ??
    (import.meta.env?.NEXT_PUBLIC_USE_MOCK_API as string | boolean | undefined) ??
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_USE_MOCK_API ?? process.env?.VITE_USE_MOCK_API : undefined);

  if (envMock !== undefined && envMock !== null && envMock !== '') {
    return String(envMock).toLowerCase() === 'true' || String(envMock) === '1';
  }

  // Default to live backend inspection so real images are processed
  return false;
}

export class ApiError extends Error {
  statusCode?: number;
  isNetworkError: boolean;
  rawDetails?: unknown;

  constructor(message: string, options?: { statusCode?: number; isNetworkError?: boolean; rawDetails?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = options?.statusCode;
    this.isNetworkError = options?.isNetworkError ?? false;
    this.rawDetails = options?.rawDetails;
  }
}

/**
 * Sends package images to POST /scan and returns the typed inspection result
 */
export async function scanPackage(images: File[], forceMock?: boolean): Promise<ScanResult> {
  if (!images || images.length === 0) {
    throw new ApiError('Please upload at least one package image to begin inspection.');
  }

  if (images.length > 3) {
    throw new ApiError('Maximum 3 images allowed per inspection scan.');
  }

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  for (const img of images) {
    const isExtensionValid = /\.(jpe?g|png|webp)$/i.test(img.name);
    if (!validTypes.includes(img.type) && !isExtensionValid) {
      throw new ApiError(`Unsupported file format "${img.name}". Please upload a JPG, JPEG, PNG, or WEBP image.`);
    }
  }

  const useMock = forceMock !== undefined ? forceMock : isMockModeConfigured();

  if (useMock) {
    // Simulate real network latency (1.4s) for smooth realistic UX
    await new Promise((resolve) => setTimeout(resolve, 1400));
    return JSON.parse(JSON.stringify(DEFAULT_MOCK_SCAN_RESULT));
  }

  const baseUrl = getApiBaseUrl();
  const endpoint = `${baseUrl}/scan`;

  const formData = new FormData();
  images.forEach((image) => {
    formData.append('images', image);
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMsg = `Inspection service responded with status ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.message) errorMsg = errorJson.message;
        else if (errorJson?.error) errorMsg = errorJson.error;
      } catch {
        // use status text
        if (response.statusText) errorMsg = `${errorMsg}: ${response.statusText}`;
      }
      throw new ApiError(errorMsg, { statusCode: response.status });
    }

    const data: ScanResult = await response.json();

    // Validate essential structure
    if (!data || typeof data !== 'object') {
      throw new ApiError('Malformed inspection response received from backend.', { rawDetails: data });
    }

    if (!data.inspection_id || typeof data.score !== 'number' || !data.overall_status) {
      throw new ApiError('Invalid inspection schema: Missing required compliance summary fields.', {
        rawDetails: data,
      });
    }

    return data;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }

    const error = err as Error;
    if (error.name === 'TypeError' || error.message.includes('fetch') || error.message.includes('Network')) {
      throw new ApiError('Unable to connect to the inspection service. Please check your network or API endpoint.', {
        isNetworkError: true,
        rawDetails: err,
      });
    }

    throw new ApiError(error.message || 'An unexpected error occurred while analyzing the package.', {
      rawDetails: err,
    });
  }
}

/**
 * Checks backend health endpoint GET /health
 */
export async function checkBackendHealth(): Promise<BackendHealthResponse> {
  const baseUrl = getApiBaseUrl();
  const endpoint = `${baseUrl}/health`;

  try {
    const response = await fetch(endpoint, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    throw new ApiError('Backend health service unreachable', { isNetworkError: true, rawDetails: err });
  }
}
