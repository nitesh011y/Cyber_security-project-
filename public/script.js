const form = document.getElementById('detectForm');
const loading = document.getElementById('loading');
const resultBox = document.getElementById('result');
const progressFill = document.getElementById('progressFill');
const messageInput = document.getElementById('message');

const statusText = document.getElementById('status');
const confidenceText = document.getElementById('confidence');
const languageText = document.getElementById('language');
const reasonList = document.getElementById('reasonList');
const suggestionList = document.getElementById('suggestionList');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return alert("Please enter a message.");

  // Reset UI
  resultBox.classList.add('hidden');
  loading.classList.remove('hidden');
  progressFill.style.width = '0%';
  statusText.textContent = "Analyzing...";
  confidenceText.textContent = "0%";
  languageText.textContent = "Detecting...";
  reasonList.innerHTML = "";
  suggestionList.innerHTML = "";

  // Simulate progress while waiting for backend
  let progress = 0;
  const interval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 10, 90);
    progressFill.style.width = `${progress.toFixed(0)}%`;
  }, 200);

  try {
    const res = await fetch('/api/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    clearInterval(interval);
    progressFill.style.width = `100%`;

    // Fill UI with result
    statusText.textContent = data.is_phishing ? "Phishing" :
                             data.is_spam ? "Spam" : "Clean";
    confidenceText.textContent = `${data.confidence}%`;
    languageText.textContent = data.language.toUpperCase();

    data.reasons.forEach(reason => {
      const li = document.createElement('li');
      li.textContent = reason;
      reasonList.appendChild(li);
    });

    data.suggestions.forEach(suggestion => {
      const li = document.createElement('li');
      li.textContent = suggestion;
      suggestionList.appendChild(li);
    });

    resultBox.classList.remove('hidden');
  } catch (err) {
    clearInterval(interval);
    alert("Something went wrong. Please try again.");
  } finally {
    loading.classList.add('hidden');
  }
}); 
