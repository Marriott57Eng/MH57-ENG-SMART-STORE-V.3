const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');

const oldCatchBlock = `    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'ขออภัยครับ เกิดข้อผิดพลาดในการดึงข้อมูลจาก AI กรุณาลองใหม่อีกครั้ง',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {`;

const newCatchBlock = `    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'ขออภัยครับ เกิดข้อผิดพลาดในการดึงข้อมูลจาก AI กรุณาลองใหม่อีกครั้ง',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory(prev => {
        const filtered = prev.filter(msg => msg.id !== aiMessageId);
        return [...filtered, errorMessage];
      });
    } finally {`;

code = code.replace(oldCatchBlock, newCatchBlock);
fs.writeFileSync('src/components/VoiceAssistantView.tsx', code);
