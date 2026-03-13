import { useRef, useEffect } from "react";

/**
 * KeepAlive: Caches and preserves the rendered children component tree while mounted.
 * Usage: <KeepAlive id="unique-page-id"> <PageComponent /> </KeepAlive>
 */
export function KeepAlive({ id, children }: { id: string; children: React.ReactNode }) {
  // Use a ref to store the cached element
  const cache = useRef<{ [key: string]: React.ReactNode }>({});

  // On mount, cache the children
  useEffect(() => {
    cache.current[id] = children;
    // No cleanup: intentionally keep in memory
  }, [id, children]);

  // Return the cached element if available, else render children
  return <>{cache.current[id] || children}</>;
}
