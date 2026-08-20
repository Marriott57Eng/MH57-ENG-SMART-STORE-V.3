const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<StatsDashboard
              summary={summary}
              items={items}
              onSelectCategory={(cat) => {`;

const replacement = `<StatsDashboard
              summary={summary}
              items={items}
              requisitions={requisitions}
              onSelectCategory={(cat) => {`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App StatsDashboard patched.');
} else {
  console.log('App StatsDashboard target not found.');
}
