const fs = require('fs');

const path = 'server.ts';
let code = fs.readFileSync(path, 'utf-8');

const oldCode = `      let responseStream;
      try {
        responseStream = await ai.models.generateContentStream({
          model: 'gemini-3.6-flash',
          contents,
          config: { systemInstruction, temperature: 0.2 },
        });
      } catch (err) {
        if (err.status === 503 || err.status === 'UNAVAILABLE' || (err.message && err.message.includes('503'))) {
          console.warn("Gemini 3.6-flash is unavailable. Falling back to Gemini 3.5-flash.");
          responseStream = await ai.models.generateContentStream({
            model: 'gemini-3.5-flash',
            contents,
            config: { systemInstruction, temperature: 0.2 },
          });
        } else {
          throw err;
        }
      }

      for await (const chunk of responseStream) {
        if (chunk.text) {
          rawResponseText += chunk.text;
          res.write(\`data: \${JSON.stringify({ type: 'chunk', text: chunk.text })}\\n\\n\`);
        }
      }`;

const newCode = `      const tryGenerate = async (modelName) => {
        const stream = await ai.models.generateContentStream({
          model: modelName,
          contents,
          config: { systemInstruction, temperature: 0.2 },
        });
        
        let localRawText = "";
        for await (const chunk of stream) {
          if (chunk.text) {
            localRawText += chunk.text;
            res.write(\`data: \${JSON.stringify({ type: 'chunk', text: chunk.text })}\\n\\n\`);
          }
        }
        return localRawText;
      };

      try {
        rawResponseText = await tryGenerate('gemini-3.6-flash');
      } catch (err) {
        if (err.status === 503 || err.status === 'UNAVAILABLE' || (err.message && err.message.includes('503')) || (err.code === 503)) {
          console.warn("Gemini 3.6 is unavailable. Falling back to Gemini 3.5.");
          // Only fallback if we haven't sent any chunks yet (rawResponseText is still empty)
          if (rawResponseText === "") {
            rawResponseText = await tryGenerate('gemini-3.5-flash');
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }`;

code = code.replace(oldCode, newCode);
fs.writeFileSync(path, code, 'utf-8');
console.log("Patched server.ts with robust model fallback");
