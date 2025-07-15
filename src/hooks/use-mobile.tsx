
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Initial check after component mounts
    checkIsMobile(); 

    window.addEventListener("resize", checkIsMobile);
    
    // Cleanup listener on unmount
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []); // Empty dependency array ensures this runs only once on the client

  return isMobile;
}
