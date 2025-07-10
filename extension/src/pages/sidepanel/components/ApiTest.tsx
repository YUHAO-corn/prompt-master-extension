import React from 'react';
import { useApiTest } from '../../../hooks/useApiTest';
import type { OptimizationMode } from '../../../services/optimization';

export function ApiTest() {
  const {
    testInput,
    setTestInput,
    testResult,
    isLoading,
    error,
    mode,
    setMode,
    runTest
  } = useApiTest();

  return (
    <div className="p-4 bg-magic-800 rounded-lg border border-magic-700/50 mt-4">
      <h2 className="text-lg font-medium text-magic-200 mb-2">DeepSeek API Test</h2>
      
      <div className="mb-4">
        <label className="block text-sm text-magic-400 mb-1">Test Input</label>
        <textarea 
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          className="w-full p-2 bg-magic-700/50 border border-magic-600/30 rounded text-sm text-magic-200"
          rows={3}
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-sm text-magic-400 mb-1">Optimization Mode</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as OptimizationMode)}
          className="w-full p-2 bg-magic-700/50 border border-magic-600/30 rounded text-sm text-magic-200"
        >
          <option value="standard">Standard Mode</option>
          <option value="creative">Creative Mode</option>
          <option value="concise">Concise Mode</option>
        </select>
      </div>
      
      <button
        onClick={runTest}
        disabled={isLoading}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed mb-4 w-full"
      >
        {isLoading ? 'Testing...' : 'Execute API Test'}
      </button>
      
      {error && (
        <div className="text-red-400 mt-2">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {testResult && (
        <div className="mt-4 p-2 bg-magic-700/50 rounded">
          <h3 className="text-sm font-medium text-magic-400 mb-1">API Result:</h3>
          <pre className="text-xs text-magic-300 whitespace-pre-wrap break-words">{testResult}</pre>
        </div>
      )}
    </div>
  );
} 