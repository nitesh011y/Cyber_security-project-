require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini with error handling
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: {
    responseMimeType: "application/json"
  }
});

app.use(express.json());
app.use(express.static('public'));

// Enhanced prompt with JSON examples
const PROMPT_TEMPLATE = `
STRICTLY return valid JSON format ONLY:
{
  "is_spam": boolean,
  "is_phishing": boolean,
  "confidence": number (1-100),
  "reasons": string[],
  "language": "en"|"hi"|"mr",
  "suggestions": string[]
}

if you got only single words like helo or generall words so its a clean code


Examples:
Good: {"is_spam":true,"is_phishing":false,"confidence":85,"reasons":["Contains 'win free prize'"],"language":"en","suggestions":["Mark as spam"]}
Bad: "This looks like spam" (INVALID)

Analyze: """{message}"""

example 2: Security Alert – Unusual Activity Detected

Dear [Employee Name],

We have detected a suspicious login attempt from an unrecognized device on your Microsoft 365 account:

Time: 08:13 AM GMT
Location: Prague, Czech Republic
IP Address: 185.33.85.197
Device: Windows 10 (Chrome)

For your protection, we have temporarily restricted access to your account until this activity is verified.

Please confirm whether this was you by logging into our Secure Verification Portal below:

🔐 Verify Recent Activity

If no action is taken within the next 2 hours, a temporary hold will remain in place and a full security review will be initiated.

Sincerely,
Microsoft Security Center
security.microsoft.com


example 3: 
Hi [Employee First Name],

I hope you’re doing well. We’ve recently finalized the updated remote work and compensation policy for Q2 following last week’s executive leadership meeting.

As part of this initiative, HR has rolled out personalized compensation review reports for all full-time staff. These documents include updates on role classification, bonus eligibility, and hybrid work status.

You can access your report securely using your corporate credentials via the following HR portal:

🔒 Access Compensation Review

Please note, this document is confidential and access is restricted to your account only. The portal will remain open until Friday, 6 PM EST.

Let me know if you face any access issues.

Regards,
Jane Sullivan
HR Business Partner
YourCompany Inc


`;

app.post('/api/detect', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    // Generate with stricter configuration
    const prompt = PROMPT_TEMPLATE.replace('{message}', sanitizeMessage(message));
    const result = await model.generateContent(prompt, {
      safetySettings: [{
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_NONE"
      }],
      generationConfig: {
        temperature: 0.3 // Reduce creativity for more consistent JSON
      }
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
      language: ["en","hi","mr"].includes(jsonData.language) ? jsonData.language : "en",
      suggestions: Array.isArray(jsonData.suggestions) ? jsonData.suggestions : []
    });

  } catch (error) {
    console.error("Full Error:", error);
    res.status(500).json({ 
      error: "Analysis failed",
      fallback: getFallbackResponse(error) // Provide basic analysis if AI fails
    });
  }
});

// Helper Functions
function sanitizeMessage(text) {
  return text.trim()
    .substring(0, 2000) // Limit length
    .replace(/"/g, "'") // Prevent JSON breakage
    .replace(/\n/g, ' '); // Single line
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
    const jsonStart = Math.max(cleanText.indexOf('{'), cleanText.indexOf('['));
    const jsonEnd = Math.max(cleanText.lastIndexOf('}'), cleanText.lastIndexOf(']')) + 1;
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
    suggestions: ["Please review manually"]
  };
}

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));