import {
  TiterInputParams,
  TiterPredictionResponse,
  SimilarityQueryParams,
  SimilarityResponse,
  TiterModelInfo,
  TiterModelPerformance,
} from '../types/ai';

const BACKEND_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')).replace(/\/$/, '');
const AI_API_BASE = `${BACKEND_BASE}/ai`;

export async function fetchTiterModelInfo(): Promise<TiterModelInfo> {
  const res = await fetch(`${AI_API_BASE}/model-info/titer`);
  if (!res.ok) {
    throw new Error(`Failed to fetch AI model info: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchTiterModelPerformance(): Promise<TiterModelPerformance> {
  const res = await fetch(`${AI_API_BASE}/model-performance/titer`);
  if (!res.ok) {
    throw new Error(`Failed to fetch AI model performance: HTTP ${res.status}`);
  }
  return res.json();
}

export async function predictTiterApi(inputParams: TiterInputParams): Promise<TiterPredictionResponse> {
  const res = await fetch(`${AI_API_BASE}/predict/titer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputParams),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `AI titer prediction failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchSimilarityApi(queryParams: SimilarityQueryParams, topK: number = 5): Promise<SimilarityResponse> {
  const res = await fetch(`${AI_API_BASE}/similarity?top_k=${topK}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(queryParams),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Historical similarity search failed: HTTP ${res.status}`);
  }
  return res.json();
}
