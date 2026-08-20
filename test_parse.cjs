const fs = require('fs');

const rawResponseText = "รับทราบครับ ดำเนินการเบิกกระดาษทรายจำนวน 5 แผ่นเรียบร้อยครับ\n\n```json:action\n{\n  \"action\": \"requisition\",\n  \"itemId\": \"ITEM-1\",\n  \"itemName\": \"กระดาษทราย\",\n  \"qty\": 5,\n  \"unit\": \"แผ่น\",\n  \"requestedBy\": \"User\",\n  \"purpose\": \"เบิกใช้งาน\",\n  \"newQty\": 5\n}\n```";

const actionMatch = rawResponseText.match(/\\\`\\\`\\\`(?:json:action|json)?\\s*(\\{[\\s\\S]*?\\})\\s*\\\`\\\`\\\`/);

console.log("actionMatch found?", !!actionMatch);
if(actionMatch) console.log(actionMatch[1]);
