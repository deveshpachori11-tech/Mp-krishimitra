module.exports = async function handler(req, res) {
  // CORS Headers
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
    return res.status(500).json({ error: 'GEMINI_API_KEY सेट नहीं है।' });
  }

  // GET Request (त्वरित टेस्ट के लिए)
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      speed: 'super-fast',
      message: 'कृषि मित्र सुपर-फास्ट AI सर्वर सक्रिय है।'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'केवल POST अनुरोध समर्थित हैं' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const userPrompt = body.prompt || body.message || body.query || body.text || '';
    const { history, image } = body;

    if (!userPrompt && !image) {
      return res.status(400).json({ error: 'कोई सवाल नहीं मिला।' });
    }

    // संक्षिप्त और तुरंत उत्तर के लिए निर्देश
    const systemPrompt = "आप 'कृषि मित्र MP' हैं। मध्य प्रदेश के किसानों को 3 से 4 छोटे बुलेट पॉइंट्स में तुरंत, सटीक और सरल समाधान दें। 15L पंप का स्प्रे नाप संक्षेप में लिखें।";

    // डेटा को हल्का रखने के लिए केवल पिछला 1 संवाद रखें
    const cleanHistory = [];
    if (Array.isArray(history)) {
      let expectedRole = 'user';
      for (const msg of history.slice(-2)) {
        const text = msg.text || msg.content || (msg.parts && msg.parts[0] && msg.parts[0].text);
        const role = (msg.role === 'user') ? 'user' : 'model';
        if (role === expectedRole && text && text.trim()) {
          cleanHistory.push({
            role: role,
            parts: [{ text: text.trim() }]
          });
          expectedRole = expectedRole === 'user' ? 'model' : 'user';
        }
      }
      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
        cleanHistory.pop();
      }
    }

    const currentParts = [];
    if (userPrompt) currentParts.push({ text: userPrompt });
    if (image) {
      currentParts.push({
        inlineData: { mimeType: 'image/jpeg', data: image }
      });
    }

    // Thinking Mode बंद: सोचने में लगने वाला 2-3 मिनट का समय खत्म
    const payload = {
      contents: [...cleanHistory, { role: 'user', parts: currentParts }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        maxOutputTokens: 350,
        thinkingConfig: {
          thinkingBudget: 0,
          thinkingLevel: 'low'
        }
      }
    };

    // आपकी लिस्ट में से सबसे सुपर-फास्ट मॉडल्स
    const fastModels = ['gemini-3.8-flash-lite', 'gemini-3.8-flash'];
    let replyText = null;
    let apiError = null;

    for (const model of fastModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const googleRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await googleRes.json();
        if (googleRes.ok) {
          replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText) break;
        } else {
          apiError = data?.error?.message || `Google Error ${googleRes.status}`;
        }
      } catch (err) {
        apiError = err.message;
      }
    }

    if (!replyText) {
      return res.status(500).json({ error: apiError || 'AI से उत्तर नहीं मिला।' });
    }

    return res.status(200).json({ reply: replyText });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'सर्वर त्रुटि' });
  }
};
