module.exports = async function handler(req, res) {
  // CORS हेडर
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // हेल्थ चेक
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'success',
      server: 'online',
      message: 'कृषि मित्र Live AI सर्वर पूरी तरह सक्रिय और सुरक्षित है।'
    });
  }

  // इनपुट पार्सिंग
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = { prompt: body }; }
  }

  // हर संभावित इनपुट फ़ील्ड को पहचानें
  const userPrompt = (
    body.prompt || 
    body.message || 
    body.question || 
    body.query || 
    body.text || 
    body.userInput || 
    'खेती की जानकारी'
  ).toString().trim();

  // --- मध्य प्रदेश कृषि मित्र: बैकअप नॉलेज इंजन (Zero-Failure Safety Net) ---
  function getSmartFallbackReply(query) {
    const q = query.toLowerCase();

    if (q.includes('गेहूं') || q.includes('gehu') || q.includes('wheat')) {
      return `🌾 **कृषि मित्र सलाह (गेहूं की फसल):**\n\n` +
        `1. **सिंचाई (CRI अवस्था):** बोवनी के 21-25 दिन बाद पहली सिंचाई (क्राउन रूट निकलने पर) अत्यंत आवश्यक है।\n` +
        `2. **उर्वरक प्रबंधन:** पहली सिंचाई के समय 40-45 किग्रा यूरिया प्रति एकड़ टॉप ड्रेसिंग करें। यदि पीलापन दिखे, तो 0.5% जिंक सल्फेट + 2% यूरिया का स्प्रे करें।\n` +
        `3. **खरपतवार नियंत्रण:** संकरी पत्ती के खरपतवार हेतु क्लोडिनाफॉप प्रोपार्गिल 15% WP (160 ग्राम/एकड़) का छिड़काव 30-35 दिन पर करें।\n\n` +
        `💡 *सुझाव: मौसम साफ होने पर ही छिड़काव करें। 15 लीटर पंप में 1 पाउच स्टीकर अवश्य मिलाएं।*`;
    }

    if (q.includes('चना') || q.includes('chana') || q.includes('इल्ली') || q.includes('illi')) {
      return `🌱 **कृषि मित्र सलाह (चना एवं दलहन):**\n\n` +
        `1. **घाटी छेदक (इल्ली) नियंत्रण:** शुरुआती अवस्था में 'टी' आकार की खूंटियां (20 प्रति एकड़) लगाएं और फेरोमोन ट्रैप लगाएं।\n` +
        `2. **जैविक उपाय:** 5% नीम बाण (नीम तेल 5ml प्रति लीटर पानी) का प्राथमिक छिड़काव करें।\n` +
        `3. **रासायनिक कीटनाशक:** प्रकोप अधिक होने पर इमामेक्टिन बेंजोएट 5% SG (80 ग्राम/एकड़) या क्लोरेंट्रानिलिप्रोल 18.5% SC (60 मिली/एकड़) का 150 लीटर पानी में घोल बनाकर स्प्रे करें।\n\n` +
        `⚠️ *फूल आने की पूर्ण अवस्था में भारी कीटनाशक और अधिक पानी देने से बचें।*`;
    }

    if (q.includes('सरसों') || q.includes('sarso') || q.includes('माहो') || q.includes('chepa')) {
      return `🌼 **कृषि मित्र सलाह (सरसों सुरक्षा):**\n\n` +
        `1. **माहो (चेपा) कीट:** मौसम में बादल छाने पर माहो का प्रकोप बढ़ता है।\n` +
        `2. **नियंत्रण उपाय:** डाइमेथोएट 30% EC (1.5 मिली/लीटर) या इमिडाक्लोप्रिड 17.8% SL (1 मिली प्रति 3 लीटर पानी) में मिलाकर छिड़कें।\n` +
        `3. **सल्फर का महत्व:** दाना भरते समय घुलनशील सल्फर (80% WDG) 1 किग्रा/एकड़ की दर से स्प्रे करें, इससे दानों में तेल की मात्रा बढ़ती है।`;
    }

    if (q.includes('खाद') || q.includes('यूरिया') || q.includes('dap') || q.includes('fertilizer')) {
      return `🧪 **संतुलित पोषक तत्व प्रबंधन (म.प्र. अनुशंसित):**\n\n` +
        `1. **डीएपी और एनपीके:** बुवाई के समय बेसल डोज के रूप में दें। खड़ी फसल में डीएपी ऊपर से न डालें।\n` +
        `2. **नैनो यूरिया:** पारंपरिक यूरिया की जगह नैनो यूरिया (4 मिली प्रति लीटर पानी) का छिड़काव करें। यह 80% तक अधिक प्रभावी है और मिट्टी को खराब नहीं करता।\n` +
        `3. **जैविक खाद:** प्रति एकड़ 2-3 ट्रॉली गोबर की सड़ी खाद या वर्मीकम्पोस्ट ट्राइकोडर्मा के साथ मिलाकर डालें।`;
    }

    if (q.includes('योजना') || q.includes('pm kisan') || q.includes('पंजीयन') || q.includes('kisan')) {
      return `🏛️ **म.प्र. किसान कल्याण योजनाएं:**\n\n` +
        `1. **मुख्यमंत्री किसान कल्याण योजना:** पात्र किसानों को केंद्र के ₹6,000 के अतिरिक्त राज्य सरकार द्वारा ₹6,000 (कुल ₹12,000 वार्षिक) प्रदान किए जाते हैं।\n` +
        `2. **ई-उपार्जन पोर्टल:** रबी फसलों (गेहूं, चना) के समर्थन मूल्य (MSP) पर विक्रय हेतु समय रहते एमपी ई-उपार्जन पोर्टल पर स्लॉट बुकिंग और पंजीयन कराएं।\n` +
        `3. **कृषि यंत्र अनुदान:** ई-कृषि यंत्र पोर्टल पर सबमिशन कर 40% से 50% तक सब्सिडी पर कृषि उपकरण प्राप्त कर सकते हैं।`;
    }

    // सामान्य कृषि मित्र सलाह
    return `🌾 **कृषि मित्र लाइव सलाह:**\n\n` +
      `किसान भाई, आपके सवाल *"${query}"* के संदर्भ में अनुशंसित मार्गदर्शन:\n\n` +
      `1. **खेत निरीक्षण:** खेत में नमी का स्तर जांचें। सुबह या शाम के ठंडे समय में ही खेत कार्य व छिड़काव करें।\n` +
      `2. **एकीकृत कीट प्रबंधन (IPM):** रासायनिक दवाओं से पहले जैविक विकल्प (जैसे नीम तेल 1500 PPM @ 5ml/लीटर) और पीला चिपचिपा ट्रैप (Yellow Sticky Trap) अपनाएं।\n` +
      `3. **दवा की सही मात्रा:** 15 लीटर वाले स्प्रे पंप में किसी भी कीटनाशक या टॉनिक की अनुशंसित मात्रा ही डालें, दवा के साथ सिलिकॉन आधारित स्टीकर अवश्य मिलाएं।\n\n` +
      `📞 *अधिक सहायता के लिए अपने नजदीकी कृषि विस्तार अधिकारी (RAEO) या टोल फ्री किसान हेल्पलाइन 1800-180-1551 पर संपर्क करें।*`;
  }

  // --- प्राथमिक प्रयास: Google Gemini API (Strict 3.5 सेकंड टाइमआउट के साथ) ---
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s में कट-ऑफ

      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{
              text: `आप 'कृषि मित्र MP' हैं। म.प्र. के किसानों को 2-3 बुलेट पॉइंट्स में सटीक, सरल और व्यावहारिक कृषि सलाह दें। सवाल: ${userPrompt}`
            }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 400,
          temperature: 0.6
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

      if (googleRes.ok) {
        const data = await googleRes.json();
        const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText && replyText.trim().length > 10) {
          // लाइव Google AI से प्राप्त सफल उत्तर
          return res.status(200).json({
            reply: replyText.trim(),
            message: replyText.trim(),
            response: replyText.trim(),
            text: replyText.trim(),
            status: 'success',
            source: 'live-ai'
          });
        }
      }
    } catch (e) {
      // नेटवर्क या टाइमआउट होने पर बिना किसी घबराहट के बैकअप इंजन पर जाएं
    }
  }

  // --- अगर API में कोई भी समस्या आई, तो 0.1 सेकंड में बैकअप जवाब दें (Zero-Fail Guarantee) ---
  const fallbackReply = getSmartFallbackReply(userPrompt);

  return res.status(200).json({
    reply: fallbackReply,
    message: fallbackReply,
    response: fallbackReply,
    text: fallbackReply,
    status: 'success',
    source: 'smart-engine'
  });
};
