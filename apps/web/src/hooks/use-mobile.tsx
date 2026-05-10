import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = React.useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    return w < MOBILE_BREAKPOINT ? 'mobile' : w < TABLET_BREAKPOINT ? 'tablet' : 'desktop';
  });

  React.useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setBreakpoint(w < MOBILE_BREAKPOINT ? 'mobile' : w < TABLET_BREAKPOINT ? 'tablet' : 'desktop');
    };

    const mqMobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const mqTablet = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`);

    mqMobile.addEventListener("change", check);
    mqTablet.addEventListener("change", check);
    check();

    return () => {
      mqMobile.removeEventListener("change", check);
      mqTablet.removeEventListener("change", check);
    };
  }, []);

  return React.useMemo(() => ({
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isMobileOrTablet: breakpoint !== 'desktop',
  }), [breakpoint]);
}

// Backward compatibility
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
