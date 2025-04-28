require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS handling (for API calls from different domains)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Spam detection logic
function analyzeMessage(message) {
  const lowerMsg = message.toLowerCase();
  const spamKeywords = ['free', 'win', 'prize', 'urgent', 'click', 'offer'];
  const scamKeywords = ['password', 'account', 'verify', 'bank', 'payment'];

  // Calculate spam probability (0-100)
  let spamScore = 0;
  
  // Keyword checks (+10% per match)
  spamKeywords.forEach(word => {
    if (lowerMsg.includes(word)) spamScore += 10;
  });

  scamKeywords.forEach(word => {
    if (lowerMsg.includes(word)) spamScore += 15;
  });

  // Structural checks
  if ((lowerMsg.match(/http|www\.|\.com/g) || []).length >= 2) spamScore += 20;
  if (message === message.toUpperCase() && message.length > 10) spamScore += 15;

  // Cap at 100%
  spamScore = Math.min(100, spamScore);

  // Determine if spanning (threshold: 40%)
  const isSpanning = spamScore >= 40;
  const confidence = isSpanning ? spamScore : 100 - spamScore;

  return {
    is_spanning: isSpanning,
    confidence: confidence,
    explanation: isSpanning 
      ? "This message exhibits spam/scam characteristics." 
      : "No significant spam patterns detected.",
    reasons: getReasons(lowerMsg)
  };
}

// Helper: Generate specific reasons
function getReasons(message) {
  const reasons = [];
  if (message.includes("free") || message.includes("win")) {
    reasons.push("Contains promotional keywords ('free', 'win')");
  }
  if (message.includes("http") || message.includes(".com")) {
    reasons.push("Contains suspicious links");
  }
  if (message.includes("password") || message.includes("bank")) {
    reasons.push("Requests sensitive information");
  }
  return reasons.length > 0 ? reasons : ["No specific red flags"];
}

// API endpoint
app.post('/api/detect', (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    res.json(analyzeMessage(message));
  } catch (error) {
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));