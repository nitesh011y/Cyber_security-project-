require("dotenv").config();
const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini with error handling
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
  generationConfig: {
    responseMimeType: "application/json",
  },
});

app.use(express.json());
app.use(express.static("public"));

// Enhanced prompt with JSON examples
const PROMPT_TEMPLATE = `
You are a security analyst detecting spam/phishing messages. Analyze the message and return STRICT JSON:

{
  "is_spam": boolean,
  "is_phishing": boolean,
  "confidence": number (1-100),
  "urls": {
    "count": number,
    "domains": string[],
    "suspicious": boolean,
    "reasons": string[]
  },
  "reasons": string[],
  "language": "en"|"hi"|"mr",
  "suggestions": string[]
}

## Classification Rules:
1. PHISHING (if any):
   - Requests credentials/personal data
   - Contains suspicious links (see URL rules)
   - Creates false urgency ("immediate action required")
   - Mimics legitimate organizations

2. SPAM (if any):
   - Unsolicited promotional content
   - Prize/giveaway offers
   - No personal relevance

3. CLEAN:
   - Normal professional communication
   - Personal messages without commercial intent
   - Single words/simple greetings

## URL Analysis Rules:
1. Suspicious URLs:
   - Domain impersonation (e.g., "microsoft.verify-security.com")
   - Shortened links (bit.ly, tinyurl)
   - IP addresses instead of domains
   - Misspelled domains (micr0soft.com)
   - HTTP links for sensitive actions
   - Mismatched display vs actual URLs

2. Clean URLs:
   - Verified company domains
   - HTTPS secure links
   - Matching display/text URLs

## Examples:

### Phishing Example:
Input: "Your account will be locked! Verify now: security-microsoft.com/login"
Output:
{
  "is_spam": false,
  "is_phishing": true,
  "confidence": 95,
  "urls": {
    "count": 1,
    "domains": ["security-microsoft.com"],
    "suspicious": true,
    "reasons": ["Impersonates Microsoft domain"]
  },
  "reasons": [
    "Creates false urgency",
    "Contains credential request",
    "Suspicious verification link"
  ],
  "language": "en",
  "suggestions": [
    "Do not click the link",
    "Report as phishing"
  ]
}

### Spam Example:
Input: "Win a free iPhone! Click: bit.ly/win-apple"
Output:
{
  "is_spam": true,
  "is_phishing": false,
  "confidence": 85,
  "urls": {
    "count": 1,
    "domains": ["bit.ly"],
    "suspicious": true,
    "reasons": ["Shortened URL hides destination"]
  },
  "reasons": [
    "Promotional content",
    "Prize/giveaway offer"
  ],
  "language": "en",
  "suggestions": [
    "Mark as spam"
  ]
}

### Clean Example:
Input: "Hi John, meeting at 3pm tomorrow"
Output:
{
  "is_spam": false,
  "is_phishing": false,
  "confidence": 99,
  "urls": {
    "count": 0,
    "domains": [],
    "suspicious": false,
    "reasons": []
  },
  "reasons": [
    "Normal professional communication"
  ],
  "language": "en",
  "suggestions": []
}

Now analyze this message:
"""{message}"""
`;

app.post("/api/detect", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    // Generate with stricter configuration
    const prompt = PROMPT_TEMPLATE.replace(
      "{message}",
      sanitizeMessage(message),
    );
    const result = await model.generateContent(prompt, {
      safetySettings: [
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE",
        },
      ],
      generationConfig: {
        temperature: 0.3, // Reduce creativity for more consistent JSON
      },
    });

    const response = await result.response;
    const text = response.text();

    // Robust JSON parsing with multiple fallbacks
    const jsonData = parseAIResponse(text);
    if (!jsonData) {
      throw new Error("AI returned invalid format");
    }

    res.json({
      is_spam: Boolean(jsonData.is_spam),
      is_phishing: Boolean(jsonData.is_phishing),
      confidence: clampConfidence(jsonData.confidence),
      reasons: Array.isArray(jsonData.reasons) ? jsonData.reasons : [],
      language: ["en", "hi", "mr"].includes(jsonData.language)
        ? jsonData.language
        : "en",
      suggestions: Array.isArray(jsonData.suggestions)
        ? jsonData.suggestions
        : [],
    });
  } catch (error) {
    console.error("Full Error:", error);
    res.status(500).json({
      error: "Analysis failed",
      fallback: getFallbackResponse(error), // Provide basic analysis if AI fails
    });
  }
});

// Helper Functions
function sanitizeMessage(text) {
  return text
    .trim()
    .substring(0, 2000) // Limit length
    .replace(/"/g, "'") // Prevent JSON breakage
    .replace(/\n/g, " "); // Single line
}

function parseAIResponse(text) {
  const cleanText = text.trim();

  // Try direct parse
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // Fallback 1: Extract JSON from code block
    const codeBlockMatch = cleanText.match(/```json\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e) {}
    }

    // Fallback 2: Find first/last braces
    const jsonStart = Math.max(cleanText.indexOf("{"), cleanText.indexOf("["));
    const jsonEnd =
      Math.max(cleanText.lastIndexOf("}"), cleanText.lastIndexOf("]")) + 1;
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        return JSON.parse(cleanText.slice(jsonStart, jsonEnd));
      } catch (e) {}
    }
  }
  return null;
}

function clampConfidence(num) {
  const n = Number(num) || 50;
  return Math.min(100, Math.max(1, n));
}

function getFallbackResponse(error) {
  return {
    is_spam: false,
    is_phishing: false,
    confidence: 50,
    reasons: ["AI analysis unavailable"],
    suggestions: ["Please review manually"],
  };
}

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
