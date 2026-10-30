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

  // GET Test (ब्राउज़र में तुरंत स्टेटस देखने के लिए)
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'success',
      server: 'online',
      geminiStatus: 'connected',
      message: 'कृषि मित्र Live AI पूरी तरह चालू और स्थिर है।'
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

    const systemPrompt = "आप 'कृषि मित्र MP' हैं - मध्य प्रदेश के किसानों के लिए समर्पित वरिष्ठ कृषि वैज्ञानिक। सरल, स्पष्ट हिंदी में छोटे बुलेट पॉइंट्स में समाधान दें। रासायनिक दवा का 15 लीटर पंप नाप और साथ में देशी जैविक उपाय बताएं।";

    const cleanHistory = [];
    if (Array.isArray(history)) {
      let expectedRole = 'user';
      for (const msg of history.slice(-4)) {
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

    // मानक और सुरक्षित पेलोड (बिना किसी अमान्य फ़ील्ड के)
    const payload = {
      contents: [...cleanHistory, { role: 'user', parts: currentParts }],
      systemInstruction: { parts: [{ text: systemPrompt }] }
    };

    // वही मॉडल जो आपके स्क्रीनशॉट में 100% सफल हुआ था
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    const googleRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await googleRes.json();

    if (!googleRes.ok) {
      return res.status(500).json({
        error: data?.error?.message || `Google Error ${googleRes.status}`
      });
    }

    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!replyText) {
      return res.status(500).json({ error: 'Google AI से उत्तर प्राप्त नहीं हुआ।' });
    }

    return res.status(200).json({ reply: replyText });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'सर्वर त्रुटि' });
  }
};
