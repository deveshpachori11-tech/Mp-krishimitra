module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Pre-flight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Environment Variable retrieval
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ''
  ).trim();

  // Self-diagnostic test on GET request
  if (req.method === 'GET') {
    if (!apiKey) {
      return res.status(200).json({
        status: 'error',
        server: 'online',
        issue: 'API_KEY_NOT_FOUND',
        message: 'Vercel Environment Variables में API Key नहीं मिली!'
      });
    }

    try {
      const testRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'नमस्ते' }] }]
          })
        }
      );

      const testData = await testRes.json();
      if (testRes.ok) {
        return res.status(200).json({
          status: 'success',
          server: 'online',
          geminiStatus: 'connected',
          message: 'कृषि मित्र Live AI सर्वर और Google Gemini दोनों 100% चालू हैं!'
        });
      } else {
        return res.status(200).json({
          status: 'error',
          server: 'online',
          issue: 'GOOGLE_API_ERROR',
          code: testRes.status,
          googleError: testData?.error?.message || JSON.stringify(testData)
        });
      }
    } catch (err) {
      return res.status(200).json({
        status: 'error',
        server: 'online',
        issue: 'FETCH_FAILED',
        error: err.message
      });
    }
  }

  // Handle POST Request (Chat)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'केवल POST और GET अनुरोध समर्थित हैं' });
  }

  try {
    if (!apiKey) {
      return res.status(500).json({
        error: 'Vercel Environment Variables में GEMINI_API_KEY नहीं मिली।'
      });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    body = body || {};

    const userPrompt = body.prompt || body.message || body.query || body.text || '';
    const { history, image } = body;

    const systemPrompt = "आप 'कृषि मित्र MP' हैं - मध्य प्रदेश के किसानों के लिए समर्पित वरिष्ठ कृषि वैज्ञानिक। आपका ज्ञान JNKVV जबलपुर और RVSKVV ग्वालियर के वैज्ञानिक पैकेजों पर आधारित है। बातचीत का पिछला संदर्भ याद रखें। रासायनिक खाद/दवा का 15 लीटर स्प्रे पंप नाप और साथ में देशी जैविक विकल्प भी दें।";

    const cleanHistory = [];
    if (Array.isArray(history)) {
      let expectedRole = 'user';
      for (const msg of history.slice(-6)) {
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

    if (currentParts.length === 0) {
      return res.status(400).json({ error: 'कोई सवाल या संदेश नहीं मिला।' });
    }

    const payload = {
      contents: [...cleanHistory, { role: 'user', parts: currentParts }],
      systemInstruction: { parts: [{ text: systemPrompt }] }
    };

    // Updated model list with Gemini 2.5 Flash
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    let lastError = null;
    let replyText = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const googleRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (googleRes.ok) {
          const data = await googleRes.json();
          replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText) break;
        } else {
          const errBody = await googleRes.text();
          lastError = new Error(`Google API ${googleRes.status}: ${errBody.slice(0, 150)}`);
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!replyText) {
      throw lastError || new Error('Google AI से उत्तर नहीं मिला');
    }

    return res.status(200).json({ reply: replyText });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'सर्वर त्रुटि' });
  }
};
