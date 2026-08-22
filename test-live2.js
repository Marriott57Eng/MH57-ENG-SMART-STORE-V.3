import 'dotenv/config';
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    console.log("Connecting...");
    const session = await ai.live.connect({ model: "gemini-2.0-flash-exp" });
    console.log("Connected successfully");
    process.exit(0);
  } catch(e) {
    console.error("Failed:", e);
    process.exit(1);
  }
}
run();
