const fs = require('fs');
let code = fs.readFileSync('src/components/StatsDashboard.tsx', 'utf8');

const targetImports = `import { InventoryItem, InventorySummary } from '../types';
import { useState } from 'react';`;

const replacementImports = `import { InventoryItem, InventorySummary, RequisitionRecord } from '../types';
import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';`;

const targetProps = `interface StatsDashboardProps {
  summary: InventorySummary | null;
  items: InventoryItem[];
  onSelectCategory: (category: string) => void;
  onFilterLowStock: () => void;
  onSelectItem: (item: InventoryItem) => void;
  onAskAI: (prompt: string) => void;
  onRefresh: () => void;
  loading: boolean;
}`;

const replacementProps = `interface StatsDashboardProps {
  summary: InventorySummary | null;
  items: InventoryItem[];
  requisitions?: RequisitionRecord[];
  onSelectCategory: (category: string) => void;
  onFilterLowStock: () => void;
  onSelectItem: (item: InventoryItem) => void;
  onAskAI: (prompt: string) => void;
  onRefresh: () => void;
  loading: boolean;
}`;

const targetDestructure = `  onAskAI,
  onRefresh,
  loading,
}) => {`;

const replacementDestructure = `  requisitions = [],
  onAskAI,
  onRefresh,
  loading,
}) => {`;

code = code.replace(targetImports, replacementImports);
code = code.replace(targetProps, replacementProps);
code = code.replace(targetDestructure, replacementDestructure);

fs.writeFileSync('src/components/StatsDashboard.tsx', code);
console.log('StatsDashboard imports and props patched.');
