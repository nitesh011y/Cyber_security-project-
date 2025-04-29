document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const analyzeBtn = document.getElementById('analyzeBtn');
  const messageInput = document.getElementById('messageInput');
  const loadingElement = document.getElementById('loading');
  const errorBox = document.getElementById('errorBox');
  const resultSection = document.getElementById('resultSection');

  analyzeBtn.addEventListener('click', analyzeMessage);

  async function analyzeMessage() {
    const message = messageInput.value.trim();
    if (!message) {
      showError("Please enter a message");
      return;
    }

    showLoading();
    hideError();
    hideResults();

    try {
      const response = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Use fallback data if available
        const fallbackData = data.fallback || {
          is_spam: false,
          is_phishing: false,
          confidence: 50,
          reasons: ["Analysis service unavailable"],
          suggestions: ["Try again later"]
        };
        displayResults(fallbackData);
        throw new Error(data.error || "Service error");
      }

      displayResults(data);
      
    } catch (error) {
      console.error("Analysis Error:", error);
      showError(error.message || "Failed to analyze");
    } finally {
      hideLoading();
    }
  }

  // UI Helpers
  function showLoading() {
    loadingElement.classList.remove('hidden');
  }

  function hideLoading() {
    loadingElement.classList.add('hidden');
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    errorBox.classList.add('hidden');
  }

  function hideResults() {
    resultSection.classList.add('hidden');
  }

  function displayResults(data) {
    // Update all result fields with null checks
    document.getElementById('threatType').textContent = 
      data.is_phishing ? "PHISHING 🚨" : 
      data.is_spam ? "SPAM ⚠️" : "CLEAN ✅";
    
    document.getElementById('confidenceValue').textContent = 
      `${data.confidence || 50}%`;
    
    document.getElementById('confidenceBar').style.width = 
      `${data.confidence || 50}%`;
    
    document.getElementById('reasonsList').innerHTML = 
      (data.reasons || []).map(r => `<li>${r}</li>`).join('');
    
    document.getElementById('suggestionsList').innerHTML = 
      (data.suggestions || []).map(s => `<li>${s}</li>`).join('');

    resultSection.classList.remove('hidden');
  }
});