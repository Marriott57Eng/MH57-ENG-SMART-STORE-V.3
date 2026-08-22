import 'dotenv/config';
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    console.log("Connecting...");
    const session = await ai.live.connect({ model: "gemini-2.5-flash" });
    console.log("Connected successfully");
    // session.close();
  } catch(e) {
    console.error("Failed:", e);
  }
}
run();
