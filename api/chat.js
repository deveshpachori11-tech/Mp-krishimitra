module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    return res.status(500).json({ error: 'Vercel में GEMINI_API_KEY सेट नहीं है।' });
  }

  const systemPrompt = `आप 'कृषि मित्र MP' हैं - मध्य प्रदेश के किसानों के लिए समर्पित वरिष्ठ कृषि वैज्ञानिक। आपका ज्ञान JNKVV जबलपुर और RVSKVV ग्वालियर के वैज्ञानिक पैकेजों पर आधारित है। बातचीत का पिछला संदर्भ याद रखें। रासायनिक खाद/दवा का 15 लीटर स्प्रे पंप नाप और साथ में देशी जैविक विकल्प भी दें।`;

  // 1. GET टेस्ट
  if (req.method === 'GET') {
    try {
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
      const testRes = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'नमस्ते किसान भाई!' }] }]
        })
      });

      const testData = await testRes.json();
      const reply = testData?.candidates?.[0]?.content?.parts?.[0]?.text;

      return res.status(200).json({
        status: 'success',
        server: 'online',
        geminiStatus: 'connected',
        activeModel: 'gemini-3.8-flash',
        sampleReply: reply || 'सक्रिय',
        message: 'कृषि मित्र Live AI पूरी तरह चालू और सक्रिय हो चुका है।'
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. मुख्य POST चैट हैंडलर
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      const { prompt, history, image } = body || {};

      if (!prompt && !image) {
        return res.status(400).json({ error: 'सवाल खाली है।' });
      }

      const cleanHistory = [];
      if (Array.isArray(history)) {
        let expectedRole = 'user';
        for (const msg of history.slice(-6)) {
          if (msg.role === expectedRole && msg.text && msg.text.trim()) {
            cleanHistory.push({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.text.trim() }]
            });
            expectedRole = expectedRole === 'user' ? 'model' : 'user';
          }
        }
        if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
          cleanHistory.pop();
        }
      }

      const currentParts = [];
      if (prompt) currentParts.push({ text: prompt });
      if (image) {
        const cleanImage = String(image).replace(/^data:image\/\w+;base64,/, '').trim();
        currentParts.push({
          inlineData: { mimeType: 'image/jpeg', data: cleanImage }
        });
      }

      const payload = {
        contents: [...cleanHistory, { role: 'user', parts: currentParts }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      };

      const models = ['gemini-3.8-flash', 'gemini-flash-latest'];
      let replyText = null;
      let lastError = null;

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
            const errText = await googleRes.text();
            lastError = errText;
          }
        } catch (err) {
          lastError = err.message;
        }
      }

      if (!replyText) {
        throw new Error(lastError || 'Google AI से उत्तर नहीं मिला');
      }

      return res.status(200).json({ reply: replyText });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'सर्वर त्रुटि' });
    }
  }

  return res.status(405).json({ error: 'केवल GET या POST समर्थित हैं।' });
};
