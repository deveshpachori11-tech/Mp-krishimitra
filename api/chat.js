```javascript
export default async function handler(req, res) {
  // CORS Headers (Browser security fix)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Pre-flight request support
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health-check support: Browser ya site check kare to 200 OK mile
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'online', 
      message: 'कृषि मित्र Live AI सर्वर सक्रिय है।' 
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'केवल POST और GET अनुरोध समर्थित हैं' });
  }

  try {
    const { prompt, history, image } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Vercel Environment Variables में GEMINI_API_KEY नहीं मिली।' 
      });
    }

    const systemPrompt = `आप 'कृषि मित्र MP' हैं - मध्य प्रदेश के किसानों के लिए समर्पित वरिष्ठ कृषि वैज्ञानिक। आपका ज्ञान JNKVV जबलपुर और RVSKVV ग्वालियर के वैज्ञानिक पैकेजों पर आधारित है। रासायनिक खाद/दवा का 15 लीटर स्प्रे पंप नाप और साथ में देशी जैविक विकल्प भी दें।`;

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
      currentParts.push({
        inlineData: { mimeType: 'image/jpeg', data: image }
      });
    }

    const payload = {
      contents: [...cleanHistory, { role: 'user', parts: currentParts }],
      systemInstruction: { parts: [{ text: systemPrompt }] }
    };

    // Stable models list
    const models = ['gemini-1.5-flash', 'gemini-2.0-flash'];
    let lastError = null;
    let replyText = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const googleRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
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
}
```
