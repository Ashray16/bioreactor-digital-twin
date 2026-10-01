import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  TiterInputParams,
  TiterPredictionResponse,
  SimilarityQueryParams,
  SimilarityResponse,
  AIServiceState,
  AIAnalysisHistoryItem,
} from '../types/ai';
import {
  fetchTiterModelInfo,
  fetchTiterModelPerformance,
  predictTiterApi,
  fetchSimilarityApi,
} from '../services/aiService';

interface AIContextType extends AIServiceState {
  runTiterPrediction: (params: TiterInputParams) => Promise<TiterPredictionResponse | null>;
  runSimilaritySearch: (params: SimilarityQueryParams, topK?: number) => Promise<SimilarityResponse | null>;
  refreshAIModelStatus: () => Promise<void>;
  clearPrediction: () => void;
  addAnalysisHistoryItem: (item: AIAnalysisHistoryItem) => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AIServiceState>({
    available: false,
    loading: true,
    error: null,
    modelInfo: null,
    modelPerformance: null,
    currentPrediction: null,
    similarityMatches: null,
    isPredicting: false,
    isSearchingSimilarity: false,
    analysisHistory: [],
  });

  const refreshAIModelStatus = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [info, perf] = await Promise.all([
        fetchTiterModelInfo(),
        fetchTiterModelPerformance(),
      ]);

      setState((prev) => ({
        ...prev,
        available: true,
        loading: false,
        error: null,
        modelInfo: info,
        modelPerformance: perf,
      }));
    } catch (err: any) {
      console.warn('AI Service unavailable or offline:', err);
      setState((prev) => ({
        ...prev,
        available: false,
        loading: false,
        error: err.message || 'AI service endpoint unreachable.',
      }));
    }
  }, []);

  // Fetch model metadata on mount only (No automatic prediction)
  useEffect(() => {
    refreshAIModelStatus();
  }, [refreshAIModelStatus]);

  const runTiterPrediction = async (params: TiterInputParams): Promise<TiterPredictionResponse | null> => {
    setState((prev) => ({ ...prev, isPredicting: true, error: null }));
    try {
      const prediction = await predictTiterApi(params);
      setState((prev) => ({
        ...prev,
        currentPrediction: prediction,
        isPredicting: false,
      }));
      return prediction;
    } catch (err: any) {
      console.error('Failed to run AI titer prediction:', err);
      const msg = err.message || 'Failed to generate AI titer prediction.';
      setState((prev) => ({
        ...prev,
        isPredicting: false,
        error: msg,
      }));
      return null;
    }
  };

  const runSimilaritySearch = async (params: SimilarityQueryParams, topK: number = 5): Promise<SimilarityResponse | null> => {
    setState((prev) => ({ ...prev, isSearchingSimilarity: true, error: null }));
    try {
      const similarity = await fetchSimilarityApi(params, topK);
      setState((prev) => ({
        ...prev,
        similarityMatches: similarity,
        isSearchingSimilarity: false,
      }));
      return similarity;
    } catch (err: any) {
      console.error('Failed to run similarity search:', err);
      const msg = err.message || 'Failed to retrieve historical similarity matches.';
      setState((prev) => ({
        ...prev,
        isSearchingSimilarity: false,
        error: msg,
      }));
      return null;
    }
  };

  const clearPrediction = () => {
    setState((prev) => ({
      ...prev,
      currentPrediction: null,
      similarityMatches: null,
    }));
  };

  const addAnalysisHistoryItem = useCallback((item: AIAnalysisHistoryItem) => {
    setState((prev) => ({
      ...prev,
      analysisHistory: [item, ...prev.analysisHistory],
    }));
  }, []);

  return (
    <AIContext.Provider
      value={{
        ...state,
        runTiterPrediction,
        runSimilaritySearch,
        refreshAIModelStatus,
        clearPrediction,
        addAnalysisHistoryItem,
      }}
    >
      {children}
    </AIContext.Provider>
  );
};

export const useAI = (): AIContextType => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};
