module.exports = async function handler(req, res) {
  // 1. CORS हेडर - ब्राउज़र सुरक्षा के लिए
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. त्वरित हेल्थ चेक (GET)
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
      return res.status(500).json({ error: 'Vercel में GEMINI_API_KEY मौजूद नहीं है।' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = { prompt: body }; }
    }

    // 3. सभी संभावित इनपुट नाम स्वीकार करें (ताकि कोई भी नाम आने पर एरर न आए)
    const userPrompt = (
      body?.prompt || 
      body?.message || 
      body?.question || 
      body?.query || 
      body?.text || 
      body?.userInput || 
      ''
    ).toString().trim();

    const image = body?.image || body?.imageBase64 || body?.photo;

    if (!userPrompt && !image) {
      return res.status(400).json({ error: 'सवाल खाली है। कृपया अपना सवाल लिखें।' });
    }

    // 4. सुरक्षित चैट हिस्ट्री निर्माण
    const contents = [];
    const rawHistory = Array.isArray(body?.history) 
      ? body.history 
      : (Array.isArray(body?.chatHistory) ? body.chatHistory : []);

    for (const msg of rawHistory.slice(-4)) {
      if (!msg) continue;
      const role = (msg.role === 'user' || msg.sender === 'user') ? 'user' : 'model';
      const text = (msg.text || msg.message || msg.content || '').toString().trim();
      if (!text) continue;

      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += '\n' + text;
      } else {
        contents.push({ role, parts: [{ text }] });
      }
    }

    // सिस्टम निर्देश को सीधे सवाल के साथ सुरक्षित जोड़ना (कोई अमान्य API पैरामीटर नहीं)
    const systemInstructionText = "आप 'कृषि मित्र MP' हैं। म.प्र. के किसानों के लिए 2-3 बुलेट पॉइंट्स में सटीक, सरल और व्यावहारिक कृषि सलाह दें। 15 लीटर पंप नाप और देशी जैविक उपाय शामिल करें।\n\nकिसान का सवाल: ";

    const currentParts = [];
    const fullPromptText = (contents.length === 0) 
      ? `${systemInstructionText}${userPrompt}` 
      : userPrompt;

    if (fullPromptText) {
      currentParts.push({ text: fullPromptText });
    }

    if (image) {
      const cleanImage = String(image).replace(/^data:image\/\w+;base64,/, '').trim();
      currentParts.push({
        inlineData: { mimeType: 'image/jpeg', data: cleanImage }
      });
    }

    // हमेशा सुनिश्चित करें कि अंतिम संदेश user का हो
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts.push(...currentParts);
    } else {
      contents.push({ role: 'user', parts: currentParts });
    }

    while (contents.length > 0 && contents[0].role !== 'user') {
      contents.shift();
    }

    // 5. एकदम शुद्ध, मानक Google पेलोड (बिना किसी प्रयोगात्मक फ़ील्ड के)
    const payload = {
      contents: contents,
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7
      }
    };

    // वही मॉडल जो आपके खाते में 100% वेरिफाइड हुआ है
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    const googleRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      return res.status(googleRes.status).json({
        error: `Google API Error (${googleRes.status}): ${errText.slice(0, 150)}`
      });
    }

    const data = await googleRes.json();
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!replyText) {
      return res.status(500).json({ error: 'मॉडल से उत्तर प्राप्त नहीं हुआ।' });
    }

    // वेबसाइट का कोड जिस भी की (key) को पढ़ रहा हो, सबको सही जवाब मिले
    return res.status(200).json({
      reply: replyText,
      message: replyText,
      response: replyText
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'आंतरिक सर्वर त्रुटि' });
  }
};
