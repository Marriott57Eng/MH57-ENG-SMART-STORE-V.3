const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace useState initialization
const oldUseState = `  const [requisitions, setRequisitions] = useState<RequisitionRecord[]>(() => {
    try {
      const saved = localStorage.getItem('warehouse_requisitions');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse requisitions from localStorage:', e);
    }
    return INITIAL_REQUISITION_LOGS;
  });`;

const newUseState = `  const [requisitions, setRequisitions] = useState<RequisitionRecord[]>([]);`;
code = code.replace(oldUseState, newUseState);

// Replace fetchInventory to also fetch requisitions
const oldFetch = `      const res = await fetch(\`/api/inventory\${forceRefresh ? '?refresh=true' : ''}\`);
      if (!res.ok) throw new Error('Failed to fetch inventory from Google Sheet');
      
      const data = await res.json();
      setItems(data.items);
      setSummary(data.summary);`;

const newFetch = `      const [res, reqRes] = await Promise.all([
        fetch(\`/api/inventory\${forceRefresh ? '?refresh=true' : ''}\`),
        fetch(\`/api/requisitions\`)
      ]);
      if (!res.ok) throw new Error('Failed to fetch inventory from Google Sheet');
      
      const data = await res.json();
      setItems(data.items);
      setSummary(data.summary);
      
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setRequisitions(reqData);
      }`;
code = code.replace(oldFetch, newFetch);

fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log("Patched App.tsx to fetch requisitions");
