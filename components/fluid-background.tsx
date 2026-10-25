"use client";

import { useEffect, useState } from "react";

/** Lightweight decorative ambient background; respects reduced-motion preferences. */
export function FluidBackground() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return (
    <div aria-hidden="true" className={`fluid-background${reducedMotion ? " motion-reduced" : ""}`}>
      <span className="fluid-orb fluid-orb-one" />
      <span className="fluid-orb fluid-orb-two" />
      <span className="fluid-orb fluid-orb-three" />
    </div>
  );
}
