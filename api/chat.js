module.exports = async function handler(req, res) {
  // CORS हेडर
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // API Key प्राप्त करें
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.API_KEY ||
    ''
  ).trim();

  if (!apiKey) {
    return res.status(500).json({
      status: 'error',
      message: 'Vercel Environment Variables में GEMINI_API_KEY नहीं मिली।'
    });
  }

  // --- ब्राउज़र में लाइव AI टेस्ट (GET Request) ---
  if (req.method === 'GET') {
    try {
      const testRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'नमस्ते, 1 छोटी पंक्ति में बताएं कि आप कौन सा AI मॉडल हैं।' }] }],
            generationConfig: { maxOutputTokens: 80 }
          })
        }
      );

      const testData = await testRes.json();
      const liveReply = testData?.candidates?.[0]?.content?.parts?.[0]?.text;

      return res.status(200).json({
        status: 'online',
        aiType: '100% PURE GOOGLE GEMINI LIVE',
        model: 'gemini-3.8-flash',
        liveAIResponse: liveReply || 'Google AI से संपर्क हुआ पर रिस्पॉन्स खाली था',
        googleStatus: testRes.status
      });
    } catch (err) {
      return res.status(500).json({
        status: 'error',
        issue: 'Google AI लाइव टेस्ट फेल हुआ',
        details: err.message
      });
    }
  }

  // --- मुख्य वेबसाइट से किसान का सवाल (POST Request) ---
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = { prompt: body }; }
  }

  // किसी भी प्रकार के इनपुट नाम को पहचानें
  let userPrompt = '';
  if (typeof body.prompt === 'string') userPrompt = body.prompt;
  else if (typeof body.message === 'string') userPrompt = body.message;
  else if (typeof body.question === 'string') userPrompt = body.question;
  else if (typeof body.query === 'string') userPrompt = body.query;
  else if (typeof body.text === 'string') userPrompt = body.text;
  else if (Array.isArray(body.contents)) {
    // अगर फ्रंटएंड पूरा चैट ऑब्जेक्ट भेज रहा हो
    for (let i = body.contents.length - 1; i >= 0; i--) {
      const item = body.contents[i];
      if (item?.parts && Array.isArray(item.parts)) {
        const found = item.parts.find(p => p && p.text);
        if (found && found.text) {
          userPrompt = found.text;
          break;
        }
      }
    }
  }

  if (!userPrompt || !userPrompt.trim()) {
    userPrompt = 'मध्य प्रदेश में फसलों की उन्नत खेती के सामान्य सुझाव दीजिए।';
  }

  try {
    // Google AI को पर्याप्त 8.5 सेकंड का समय दें (Vercel टाइमआउट से सुरक्षित)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500);

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `आप 'कृषि मित्र MP' हैं - मध्य प्रदेश के किसानों के लिए एक बुद्धिमान AI कृषि वैज्ञानिक। किसान के सवाल का बिंदुवार, सरल और व्यावहारिक हिंदी में उत्तर दें:\n\nसवाल: ${userPrompt}`
            }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 350,
        temperature: 0.7
      }
    };

    const googleRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    const data = await googleRes.json();

    if (!googleRes.ok) {
      return res.status(googleRes.status).json({
        status: 'error',
        source: 'Google API Error',
        code: googleRes.status,
        message: data?.error?.message || 'Google AI ने एरर दिया'
      });
    }

    const aiGeneratedReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiGeneratedReply) {
      return res.status(500).json({
        status: 'error',
        message: 'Google AI ने कोई टेक्स्ट जनरेट नहीं किया।'
      });
    }

    // शुद्ध Google AI का लाइव उत्तर भेजें
    return res.status(200).json({
      reply: aiGeneratedReply.trim(),
      message: aiGeneratedReply.trim(),
      response: aiGeneratedReply.trim(),
      text: aiGeneratedReply.trim(),
      status: 'success',
      source: '100% Pure Google Gemini Live AI',
      model: 'gemini-3.8-flash'
    });

  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.name === 'AbortError' 
        ? 'Google AI को उत्तर देने में 8.5 सेकंड से अधिक समय लगा।' 
        : `सर्वर एरर: ${err.message}`
    });
  }
};
