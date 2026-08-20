const { GoogleGenAI } = require("@google/genai");

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const start = Date.now();
  console.log("Testing gemini-3.7-flash...");
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: "Hello"
    });
    console.log("Success! Time:", Date.now() - start, "ms");
  } catch(e) {
    console.log("Error:", e.message);
  }
}
test();
