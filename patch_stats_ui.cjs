const fs = require('fs');
let code = fs.readFileSync('src/components/StatsDashboard.tsx', 'utf8');

const targetUI = `    </div>
  );
};`;

const replacementUI = `
      {/* Analytics: Top Items This Month */}
      {topItemsThisMonth.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-emerald-500" />
            <h2 className="font-bold text-slate-800 text-lg">รายการเบิกสูงสุดเดือนนี้</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItemsThisMonth} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="qty" name="จำนวนที่เบิก" fill="#10B981" radius={[0, 4, 4, 0]}>
                  {topItemsThisMonth.map((entry, index) => (
                    <Cell key={\`cell-\${index}\`} fill={['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'][index % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Analytics: Monthly Trend */}
      {monthlyTrend.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpRight className="w-6 h-6 text-blue-500" />
            <h2 className="font-bold text-slate-800 text-lg">แนวโน้มการเบิกจ่าย (ยอดรวม)</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="qty" name="จำนวนรวม" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Analytics: Out of Stock Duration */}
      {outOfStockDurations.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h2 className="font-bold text-slate-800 text-lg">สินค้าหมดสต๊อกนานที่สุด (วัน)</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outOfStockDurations} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="days" name="จำนวนวัน" fill="#EF4444" radius={[4, 4, 0, 0]}>
                  {outOfStockDurations.map((entry, index) => (
                    <Cell key={\`cell-\${index}\`} fill={entry.days > 7 ? '#EF4444' : '#F87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};`;

if (code.includes(targetUI)) {
  code = code.replace(targetUI, replacementUI);
  fs.writeFileSync('src/components/StatsDashboard.tsx', code);
  console.log('StatsDashboard UI appended.');
} else {
  console.log('StatsDashboard UI target not found.');
}
