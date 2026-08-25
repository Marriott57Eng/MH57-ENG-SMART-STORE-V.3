import React from 'react';
import { motion } from 'motion/react';

interface InventorySkeletonProps {
  count?: number;
}

export const InventorySkeleton: React.FC<InventorySkeletonProps> = ({ count = 6 }) => {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: idx * 0.04 }}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs relative overflow-hidden"
        >
          {/* Shimmer gradient overlay */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-slate-100/70 dark:via-slate-800/60 to-transparent pointer-events-none" />

          <div className="flex gap-3">
            <div className="flex-1 min-w-0 space-y-2.5">
              {/* Badges row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-20 h-5 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
                  <div className="w-16 h-5 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
                </div>
                <div className="w-24 h-5 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
              </div>

              {/* Title lines */}
              <div className="space-y-1.5 pt-0.5">
                <div className="w-4/5 h-4.5 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
                <div className="w-1/2 h-3.5 bg-slate-100 dark:bg-slate-800/60 rounded-md animate-pulse" />
              </div>

              {/* Bottom metadata */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <div className="w-28 h-4 bg-slate-100 dark:bg-slate-800 rounded-md animate-pulse" />
                <div className="w-20 h-5 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
