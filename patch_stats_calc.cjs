const fs = require('fs');
let code = fs.readFileSync('src/components/StatsDashboard.tsx', 'utf8');

const targetCalc = `  const lowStockItems = items.filter((item) => item.status === 'low' || item.status === 'out');`;

const replacementCalc = `  const lowStockItems = items.filter((item) => item.status === 'low' || item.status === 'out');

  // --- NEW ANALYTICS ---
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  const currentMonthRequisitions = useMemo(() => {
    return requisitions.filter(req => {
      if (req.type !== 'out') return false;
      try {
        const d = parseISO(req.isoDate);
        return isWithinInterval(d, { start: currentMonthStart, end: currentMonthEnd });
      } catch (e) {
        return false;
      }
    });
  }, [requisitions, currentMonthStart, currentMonthEnd]);

  const topItemsThisMonth = useMemo(() => {
    const counts: Record<string, { name: string; qty: number }> = {};
    currentMonthRequisitions.forEach(req => {
      if (!counts[req.itemId]) {
        counts[req.itemId] = { name: req.itemName, qty: 0 };
      }
      counts[req.itemId].qty += req.qty;
    });
    return Object.values(counts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [currentMonthRequisitions]);

  const monthlyTrend = useMemo(() => {
    const trend: Record<string, number> = {};
    const outReqs = requisitions.filter(r => r.type === 'out');
    outReqs.forEach(req => {
      try {
        const d = parseISO(req.isoDate);
        const monthYear = format(d, 'MMM yy', { locale: th });
        trend[monthYear] = (trend[monthYear] || 0) + req.qty;
      } catch (e) {}
    });
    // Convert to array and sort (very basic sorting assuming mostly recent data)
    // For robust sorting we might want to store actual date and sort, but let's keep it simple
    return Object.entries(trend).map(([month, qty]) => ({ month, qty })).reverse().slice(0, 6).reverse(); 
  }, [requisitions]);

  const outOfStockDurations = useMemo(() => {
    const outItems = items.filter(item => item.status === 'out' && item.outOfStockDate);
    return outItems.map(item => {
      try {
        const outDate = parseISO(item.outOfStockDate!);
        const days = differenceInDays(new Date(), outDate);
        return { name: item.name, days: days < 0 ? 0 : days, date: outDate };
      } catch (e) {
        return { name: item.name, days: 0, date: new Date() };
      }
    }).sort((a, b) => b.days - a.days).slice(0, 5);
  }, [items]);
`;

code = code.replace(targetCalc, replacementCalc);
fs.writeFileSync('src/components/StatsDashboard.tsx', code);
console.log('StatsDashboard calc patched.');
