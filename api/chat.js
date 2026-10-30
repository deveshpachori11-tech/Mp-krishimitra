module.exports = async function handler(req, res) {
  // CORS Headers (सभी अनुरोधों के लिए)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();

  if (!apiKey) {
    return res.status(500).json({ error: 'Vercel में GEMINI_API_KEY सेट नहीं है।' });
  }

  // Google AI से बात करने का सबसे सुरक्षित और तेज़ फ़ंक्शन
  async function callGemini(userPrompt, imageBase64) {
    const systemGuide = "आप 'कृषि मित्र MP' हैं - मध्य प्रदेश के किसानों के लिए समर्पित वरिष्ठ कृषि वैज्ञानिक। संक्षिप्त, स्पष्ट हिंदी बुलेट पॉइंट्स में व्यावहारिक समाधान दें। 15 लीटर स्प्रे पंप की सही दवा नाप और देशी जैविक उपाय बताएं।";
    
    // सुरक्षित इनलाइन प्रॉम्प्ट (ताकि Google API सिंटैक्स एरर न दे)
    const combinedText = `${systemGuide}\n\nकिसान का सवाल: ${userPrompt}`;

    const parts = [{ text: combinedText }];
    if (imageBase64) {
      const cleanData = String(imageBase64).replace(/^data:image\/\w+;base64,/, '').trim();
      if (cleanData) {
        parts.push({
          inlineData: { mimeType: 'image/jpeg', data: cleanData }
        });
      }
    }

    const payload = {
      contents: [{ role: 'user', parts: parts }]
    };

    // जो मॉडल सक्रिय हैं उनकी सुरक्षित सूची
    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest'];
    let lastError = null;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok) {
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return { success: true, text: text, model: model };
          }
        } else {
          lastError = data?.error?.message || `HTTP ${response.status}`;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    return { success: false, error: lastError || 'Google AI से उत्तर नहीं मिला।' };
  }

  // 1. GET अनुरोध (असली लाइव टेस्ट)
  if (req.method === 'GET') {
    const test = await callGemini('नमस्ते! केवल एक छोटा वाक्य बोलें कि आप तैयार हैं।', null);
    if (test.success) {
      return res.status(200).json({
        status: 'success',
        server: 'online',
        geminiStatus: 'connected',
        activeModel: test.model,
        testReply: test.text,
        message: 'बधाई! कृषि मित्र Live AI अब पूरी तरह लाइव जवाब दे रहा है।'
      });
    } else {
      return res.status(500).json({
        status: 'error',
        googleError: test.error
      });
    }
  }

  // 2. POST अनुरोध (मुख्य वेबसाइट से आने वाले सवाल)
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      body = body || {};

      const prompt = body.prompt || body.message || body.query || body.text || '';
      const image = body.image || null;

      if (!prompt && !image) {
        return res.status(400).json({ error: 'सवाल खाली है।' });
      }

      const result = await callGemini(prompt, image);

      if (result.success) {
        return res.status(200).json({ reply: result.text });
      } else {
        return res.status(500).json({ error: result.error });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message || 'सर्वर आंतरिक त्रुटि' });
    }
  }

  return res.status(405).json({ error: 'अनुरोध अमान्य है।' });
};
