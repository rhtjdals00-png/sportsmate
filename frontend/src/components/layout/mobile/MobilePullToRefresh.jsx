import React, { useState, useEffect, useCallback, useRef } from 'react';

export default function MobilePullToRefresh({ onRefresh, children }) {
  const [startY, setStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef(null);
  
  const MAX_PULL = 80;

  const handleTouchStart = useCallback((e) => {
    // Only allow pull-to-refresh if we are at the very top of the page
    if (window.scrollY <= 0) {
      setStartY(e.touches[0].clientY);
    } else {
      setStartY(0);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (startY === 0 || isRefreshing) return;
    
    const y = e.touches[0].clientY;
    const distance = y - startY;

    // Only handle pull down when at the top
    if (distance > 0 && window.scrollY <= 0) {
      setIsPulling(true);
      setPullDistance(Math.min(distance * 0.4, MAX_PULL));
      
      if (e.cancelable) {
        e.preventDefault();
      }
    } else {
      setIsPulling(false);
      setPullDistance(0);
    }
  }, [startY, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (isPulling && pullDistance >= MAX_PULL * 0.8) {
      setIsRefreshing(true);
      setIsPulling(false);
      setPullDistance(MAX_PULL * 0.5); // hold indicator while loading
      
      if (onRefresh) {
        await onRefresh();
      }
      
      setIsRefreshing(false);
      setPullDistance(0);
    } else {
      setIsPulling(false);
      setPullDistance(0);
    }
    setStartY(0);
  }, [isPulling, pullDistance, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    // Use passive: false for touchmove to allow preventDefault
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', minHeight: '100vh', touchAction: isPulling ? 'none' : 'auto' }}>
      {/* Pull indicator */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: `${MAX_PULL}px`,
          transform: `translateY(${pullDistance - MAX_PULL}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
          zIndex: 50,
          opacity: pullDistance / MAX_PULL,
        }}
      >
        <div style={{
          background: 'white',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          {isRefreshing ? (
             <svg style={{ animation: 'spin 1s linear infinite' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          ) : (
            <svg style={{ transform: `rotate(${pullDistance * 2}deg)` }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      {/* Children content that slides down */}
      <div style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isPulling ? 'none' : 'transform 0.3s ease-out',
        width: '100%',
        minHeight: '100%'
      }}>
        {children}
      </div>
    </div>
  );
}
