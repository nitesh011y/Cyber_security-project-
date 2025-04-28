document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultSection = document.getElementById('resultSection');
    const loadingElement = document.getElementById('loading');
    const resultLabel = document.getElementById('resultLabel');
    const confidenceValue = document.getElementById('confidenceValue');
    const confidenceBar = document.getElementById('confidenceBar');
    const explanation = document.getElementById('explanation');
  
    analyzeBtn.addEventListener('click', async () => {
      const message = messageInput.value.trim();
      
      if (!message) {
        alert('Please enter a message to analyze');
        return;
      }
  
      loadingElement.classList.remove('hidden');
      resultSection.classList.add('hidden');
  
      try {
        const response = await fetch('/api/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
  
        if (!response.ok) throw new Error('Analysis failed');
        const data = await response.json();
        displayResults(data);
      } catch (error) {
        console.error(error);
        alert('Error analyzing message');
      } finally {
        loadingElement.classList.add('hidden');
        resultSection.classList.remove('hidden');
      }
    });
  
    function displayResults(data) {
      const isSpanning = data.is_spanning;
      const confidence = Math.round(data.confidence);
  
      // Update UI
      resultLabel.textContent = isSpanning ? 'Spanning' : 'Not Spanning';
      resultLabel.className = `result-label ${isSpanning ? 'spanning' : 'not-spanning'}`;
      confidenceValue.textContent = `${confidence}%`;
      confidenceBar.style.width = `${confidence}%`;
      confidenceBar.style.backgroundColor = isSpanning ? 'var(--danger)' : 'var(--success)';
  
      // Build explanation HTML
      let explanationHTML = `<p>${data.explanation}</p>`;
      if (data.reasons && data.reasons.length > 0) {
        explanationHTML += '<ul>' + data.reasons.map(r => `<li>${r}</li>`).join('') + '</ul>';
      }
      explanation.innerHTML = explanationHTML;
    }
  });