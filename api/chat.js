let workingModel = null;

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Pre-flight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // API Key fetch
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ''
  ).trim();

  if (!apiKey) {
    return res.status(500).json({
      status: 'error',
      server: 'online',
      issue: 'API_KEY_NOT_FOUND',
      error: 'Vercel Environment Variables में GEMINI_API_KEY नहीं मिली।'
    });
  }

  // Models priority list recommended by Google
  const preferredModels = [
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-3.1-flash-lite'
  ];

  // GET Request (Live Testing & Model Verification)
  if (req.method === 'GET') {
    let successData = null;
    let successfulModel = null;
    let lastErrorMsg = null;

    for (const model of preferredModels) {
      try {
        const testRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'नमस्ते किसान मित्र' }] }]
            })
          }
        );

        const data = await testRes.json();
        if (testRes.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          successData = data;
          successfulModel = model;
          workingModel = model;
          break;
        } else {
          lastErrorMsg = data?.error?.message || JSON.stringify(data);
        }
      } catch (err) {
        lastErrorMsg = err.message;
      }
    }

    if (successfulModel) {
      return res.status(200).json({
        status: 'success',
        server: 'online',
        geminiStatus: 'connected',
        activeModel: successfulModel,
        sampleReply: successData?.candidates?.[0]?.content?.parts?.[0]?.text,
        message: 'बधाई! कृषि मित्र Live AI पूरी तरह चालू और कनेक्ट हो चुका है।'
      });
    } else {
      return res.status(200).json({
        status: 'error',
        server: 'online',
        issue: 'MODELS_TEST_FAILED',
        lastGoogleError: lastErrorMsg
      });
    }
  }

  // POST Request (Main Question/Answer Engine)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'केवल POST और GET अनुरोध समर्थित हैं' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
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

    const modelsToTry = workingModel ? [workingModel, ...preferredModels] : preferredModels;
    const uniqueModels = [...new Set(modelsToTry)];

    let replyText = null;
    let lastError = null;

    for (const model of uniqueModels) {
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
          if (replyText) {
            workingModel = model;
            break;
          }
        } else {
          const errBody = await googleRes.text();
          lastError = new Error(`Google API (${model}) ${googleRes.status}: ${errBody.slice(0, 150)}`);
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
