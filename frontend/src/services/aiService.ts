import {
  TiterInputParams,
  TiterPredictionResponse,
  SimilarityQueryParams,
  SimilarityResponse,
  TiterModelInfo,
  TiterModelPerformance,
} from '../types/ai';

import {
  clientFetchTiterModelInfo,
  clientFetchTiterModelPerformance,
  clientPredictTiter,
  clientFetchSimilarity,
} from './clientSimulationEngine';

import { isUsingClientFallback, setUsingClientFallback } from './api';

const BACKEND_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')).replace(/\/$/, '');
const AI_API_BASE = `${BACKEND_BASE}/ai`;

export async function fetchTiterModelInfo(): Promise<TiterModelInfo> {
  if (isUsingClientFallback()) {
    return clientFetchTiterModelInfo();
  }
  try {
    const res = await fetch(`${AI_API_BASE}/model-info/titer`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    setUsingClientFallback(true);
    return clientFetchTiterModelInfo();
  }
}

export async function fetchTiterModelPerformance(): Promise<TiterModelPerformance> {
  if (isUsingClientFallback()) {
    return clientFetchTiterModelPerformance();
  }
  try {
    const res = await fetch(`${AI_API_BASE}/model-performance/titer`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    setUsingClientFallback(true);
    return clientFetchTiterModelPerformance();
  }
}

export async function predictTiterApi(inputParams: TiterInputParams): Promise<TiterPredictionResponse> {
  if (isUsingClientFallback()) {
    return clientPredictTiter(inputParams);
  }
  try {
    const res = await fetch(`${AI_API_BASE}/predict/titer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputParams),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || `AI titer prediction failed: HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    return clientPredictTiter(inputParams);
  }
}

export async function fetchSimilarityApi(queryParams: SimilarityQueryParams, topK: number = 5): Promise<SimilarityResponse> {
  if (isUsingClientFallback()) {
    return clientFetchSimilarity(queryParams, topK);
  }
  try {
    const res = await fetch(`${AI_API_BASE}/similarity?top_k=${topK}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryParams),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || `Historical similarity search failed: HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    return clientFetchSimilarity(queryParams, topK);
  }
}
