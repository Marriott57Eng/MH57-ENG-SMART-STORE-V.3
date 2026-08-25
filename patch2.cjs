const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// We want to extract itemCards from the parsed action
content = content.replace(
  'let itemCards: any[] | undefined = undefined;',
  `let itemCards: any[] | undefined = undefined;
      
      const parsedActionMatches = rawResponseText.match(/\`\`\`(?:json:action|json)?\\s*(\\{[\\s\\S]*?\\})\\s*\`\`\`/);
      let parsedSearchAction: any = null;
      if (parsedActionMatches && parsedActionMatches[1]) {
         try {
            const tempAction = JSON.parse(parsedActionMatches[1]);
            if (tempAction.action === 'search' && Array.isArray(tempAction.itemIds)) {
               parsedSearchAction = tempAction;
            }
         } catch (e) {}
      }`
);

content = content.replace(
  '        const exactMatches = items.filter(item => {',
  `        let exactMatches = [];
        if (parsedSearchAction && parsedSearchAction.itemIds.length > 0) {
           exactMatches = items.filter(item => parsedSearchAction.itemIds.includes(item.id));
        } else {
           exactMatches = items.filter(item => {`
);

content = content.replace(
  '          return idInPrompt || idInResponse || nameInPrompt || nameInResponse;\n        });',
  `          return idInPrompt || idInResponse || nameInPrompt || nameInResponse;\n        });\n        }`
);

fs.writeFileSync('server.ts', content);
