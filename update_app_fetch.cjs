const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStr = `  const fetchInventory = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const res = await fetch(\`/api/inventory\${forceRefresh ? '?refresh=true' : ''}\`);
      if (!res.ok) throw new Error('Failed to fetch inventory from Google Sheet');

      const data = await res.json();
      setItems(data.items || []);
      setSummary(data.summary || null);
      
      // Trigger low stock alert if needed
      if (data.summary && (data.summary.lowStockCount > 0 || data.summary.outOfStockCount > 0)) {
        if (!hasShownAlert) {
          setShowLowStockAlert(true);
          setHasShownAlert(true);
        }
      }
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
      setError(err.message || 'ไม่สามารถโหลดข้อมูลจาก Google Sheet ได้');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };`;

const newStr = `  const fetchRequisitions = async () => {
    try {
      const res = await fetch('/api/requisitions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRequisitions(data);
        }
      }
    } catch (err) {
      console.error('Error fetching requisitions:', err);
    }
  };

  const fetchInventory = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const res = await fetch(\`/api/inventory\${forceRefresh ? '?refresh=true' : ''}\`);
      if (!res.ok) throw new Error('Failed to fetch inventory from Google Sheet');

      const data = await res.json();
      setItems(data.items || []);
      setSummary(data.summary || null);
      
      // Fetch requisitions
      fetchRequisitions();
      
      // Trigger low stock alert if needed
      if (data.summary && (data.summary.lowStockCount > 0 || data.summary.outOfStockCount > 0)) {
        if (!hasShownAlert) {
          setShowLowStockAlert(true);
          setHasShownAlert(true);
        }
      }
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
      setError(err.message || 'ไม่สามารถโหลดข้อมูลจาก Google Sheet ได้');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };`;

code = code.replace(targetStr, newStr);
fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log("Updated App.tsx with fetchRequisitions");
