import { useEffect, useRef, useState } from "react";

// Fades + lifts children into view the first time they cross the viewport,
// staggered by `index` so grids reveal sequentially instead of popping in at once.
function RevealOnScroll({ index = 0, className = "", children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`fd-reveal ${visible ? "fd-reveal-visible" : ""} ${className}`}
      style={{ transitionDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      {children}
    </div>
  );
}

export default RevealOnScroll;
