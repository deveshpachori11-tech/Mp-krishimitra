module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. हेल्थ चेक (GET)
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      message: 'कृषि मित्र Live AI सर्वर सक्रिय है।'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'केवल POST अनुरोध समर्थित हैं' });
  }

  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({ error: 'Vercel में GEMINI_API_KEY सेट नहीं है।' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const { prompt, history, image } = body || {};

    if (!prompt && !image) {
      return res.status(400).json({ error: 'सवाल खाली है।' });
    }

    // --- Google API के लिए 100% सुरक्षित हिस्ट्री सैनिटाइज़र ---
    // यह सुनिश्चित करता है कि कभी भी दो समान रोल (user/user) एक साथ न आएँ
    const sanitizedContents = [];
    const rawHistory = Array.isArray(history) ? history.slice(-6) : [];

    for (const msg of rawHistory) {
      if (!msg || !msg.text || !msg.text.trim()) continue;
      
      // फ्रंटएंड किसी भी नाम से रोल भेजे (bot, assistant, model), उसे सही करें
      const role = (msg.role === 'user' || msg.sender === 'user') ? 'user' : 'model';
      const text = msg.text.trim();

      // अगर पिछला संदेश भी उसी रोल का था, तो अलग बनाने के बजाय उसी में टेक्स्ट जोड़ें
      if (sanitizedContents.length > 0 && sanitizedContents[sanitizedContents.length - 1].role === role) {
        sanitizedContents[sanitizedContents.length - 1].parts[0].text += '\n' + text;
      } else {
        sanitizedContents.push({
          role: role,
          parts: [{ text: text }]
        });
      }
    }

    // मौजूदा सवाल को तैयार करें
    const currentParts = [];
    if (prompt && prompt.trim()) {
      currentParts.push({ text: prompt.trim() });
    }
    if (image) {
      const cleanImage = String(image).replace(/^data:image\/\w+;base64,/, '').trim();
      currentParts.push({
        inlineData: { mimeType: 'image/jpeg', data: cleanImage }
      });
    }

    // अगर हिस्ट्री के अंत में 'user' था, तो उसमें जोड़ें, अन्यथा नया 'user' टर्न बनाएँ
    if (sanitizedContents.length > 0 && sanitizedContents[sanitizedContents.length - 1].role === 'user') {
      sanitizedContents[sanitizedContents.length - 1].parts = [
        ...sanitizedContents[sanitizedContents.length - 1].parts,
        ...currentParts
      ];
    } else {
      sanitizedContents.push({
        role: 'user',
        parts: currentParts
      });
    }

    // यह सुनिश्चित करें कि पहला संदेश हमेशा 'user' से शुरू हो
    while (sanitizedContents.length > 0 && sanitizedContents[0].role !== 'user') {
      sanitizedContents.shift();
    }

    const systemPrompt = `आप 'कृषि मित्र MP' हैं - मध्य प्रदेश के किसानों के लिए समर्पित वरिष्ठ कृषि वैज्ञानिक। आपका ज्ञान JNKVV जबलपुर और RVSKVV ग्वालियर के वैज्ञानिक पैकेजों पर आधारित है। मध्य प्रदेश के मौसम, मिट्टी और फसलों (सोयाबीन, गेहूं, चना, सरसों, लहसुन) के अनुसार बिंदुवार (bullet points) सटीक सलाह दें। रासायनिक दवा का 15 लीटर पंप माप और साथ में देशी जैविक उपाय अवश्य बताएं। जवाब संक्षिप्त और स्पष्ट रखें।`;

    const payload = {
      contents: sanitizedContents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        maxOutputTokens: 600, // 2-3 सेकंड में पूरा उत्तर देने के लिए
        temperature: 0.6
      }
    };

    // 9 सेकंड का सख्त टाइमआउट (ताकि Vercel का 10s क्रैश कभी न हो)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8800);

    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    const googleRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      return res.status(googleRes.status).json({
        error: `Google API Error (${googleRes.status}): ${errText.slice(0, 200)}`
      });
    }

    const data = await googleRes.json();
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!replyText) {
      return res.status(500).json({ error: 'AI मॉडल से खाली उत्तर प्राप्त हुआ।' });
    }

    return res.status(200).json({ reply: replyText });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Google AI ने उत्तर देने में बहुत अधिक समय लिया, कृपया दोबारा पूछें।' });
    }
    return res.status(500).json({ error: err.message || 'आंतरिक सर्वर त्रुटि' });
  }
};
