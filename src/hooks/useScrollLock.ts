import { useEffect, useLayoutEffect } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

let activeLocksCount = 0;

/**
 * Custom hook to lock body scroll when a modal/dialog is active.
 * Uses isomorphic layout effect and CSS class to prevent layout shifts and eliminate flickering.
 */
export function useScrollLock(isLocked: boolean = true) {
  useIsomorphicLayoutEffect(() => {
    if (!isLocked || typeof document === 'undefined') return;

    activeLocksCount++;
    if (activeLocksCount === 1) {
      document.body.classList.add('modal-open');
    }

    return () => {
      activeLocksCount = Math.max(0, activeLocksCount - 1);
      if (activeLocksCount === 0) {
        document.body.classList.remove('modal-open');
      }
    };
  }, [isLocked]);
}

export default useScrollLock;
