const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Helper function for error handling with timeout
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `API Error: ${response.status}`);
  }
  return response.json();
};

// Helper function for fetch with timeout
const fetchWithTimeout = (url, options, timeout = 25000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    ),
  ]);
};

export const analyzeArticle = async (url) => {
  // For now, use the fast endpoint with a test text
  // Later you can implement proper URL fetching
  const testText = "Scientists discover miracle cure for cancer. This breakthrough treatment will be available next week.";
  
  const response = await fetchWithTimeout(`${API_BASE_URL}/analyze-fast?text=${encodeURIComponent(testText)}`, {
    method: 'POST',
  }, 10000);
  return handleResponse(response);
};

export const getTrendingNews = async (topic = 'top', country = 'US', lang = 'en') => {
  const response = await fetch(`${API_BASE_URL}/trending?topic=${topic}&country=${country}&lang=${lang}`);
  return handleResponse(response);
};

export const getHistory = async (limit = 50) => {
  const response = await fetch(`${API_BASE_URL}/history?limit=${limit}`);
  return handleResponse(response);
};

export const deleteHistoryItem = async (itemId) => {
  const response = await fetch(`${API_BASE_URL}/history/${itemId}`, { method: 'DELETE' });
  return handleResponse(response);
};

export const clearHistory = async () => {
  const response = await fetch(`${API_BASE_URL}/history`, { method: 'DELETE' });
  return handleResponse(response);
};

export const getChatHistory = async (analysisId) => {
  const response = await fetch(`${API_BASE_URL}/chat/${analysisId}`);
  return handleResponse(response);
};

export const chatAboutArticle = async (analysisId, question, history) => {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      analysis_id: analysisId,
      question: question,
      history: history,
    }),
  });
  return handleResponse(response);
};

export const clearChatHistory = async (analysisId) => {
  const response = await fetch(`${API_BASE_URL}/chat/${analysisId}`, { method: 'DELETE' });
  return handleResponse(response);
};

export const getStats = async () => {
  const response = await fetch(`${API_BASE_URL}/stats`);
  return handleResponse(response);
};

// Export as object for backward compatibility
export const api = {
  analyzeArticle,
  getTrendingNews,
  getHistory,
  deleteHistoryItem,
  clearHistory,
  getChatHistory,
  chatAboutArticle,
  clearChatHistory,
  getStats,
  // Add these axios-style methods for components that use api.post() with timeout
  post: async (endpoint, data) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, 25000);
    return { data: await handleResponse(response) };
  },
  get: async (endpoint) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    return { data: await handleResponse(response) };
  },
  delete: async (endpoint) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'DELETE' });
    return { data: await handleResponse(response) };
  },
};