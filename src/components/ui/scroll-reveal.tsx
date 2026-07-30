"use client";

import React, { useEffect, useRef, useState } from "react";

interface ScrollRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  direction?: "up" | "down" | "left" | "right" | "none";
  delay?: number; // in milliseconds
  duration?: number; // in milliseconds
  distance?: string;
  once?: boolean;
  className?: string;
  staggerIndex?: number;
}

export function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 600,
  distance = "24px",
  once = true,
  className = "",
  staggerIndex = 0,
  style,
  ...props
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Initialize visibility state depending on availability of APIs
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      return true;
    }
    return false;
  });

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        return false;
      }
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    try {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

      const handleChange = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches);
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", handleChange);
        }
      };
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (
      prefersReducedMotion ||
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const currentRef = ref.current;
    if (!currentRef) return;

    let observer: IntersectionObserver | null = null;

    try {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (once && observer && currentRef) {
              observer.unobserve(currentRef);
            }
          } else if (!once) {
            setIsVisible(false);
          }
        },
        {
          threshold: 0.15,
          rootMargin: "0px 0px -40px 0px",
        }
      );

      observer.observe(currentRef);
    } catch {
      // Fallback
    }

    return () => {
      if (observer && currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [once, prefersReducedMotion]);

  const totalDelay = delay + staggerIndex * 100;

  const getTransform = () => {
    if (isVisible || prefersReducedMotion) return "translate3d(0, 0, 0)";

    switch (direction) {
      case "up":
        return `translate3d(0, ${distance}, 0)`;
      case "down":
        return `translate3d(0, -${distance}, 0)`;
      case "left":
        return `translate3d(${distance}, 0, 0)`;
      case "right":
        return `translate3d(-${distance}, 0, 0)`;
      case "none":
      default:
        return "translate3d(0, 0, 0)";
    }
  };

  const animationStyle: React.CSSProperties = prefersReducedMotion
    ? { ...style }
    : {
        ...style,
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${totalDelay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${totalDelay}ms`,
        willChange: "opacity, transform",
      };

  return (
    <div ref={ref} className={className} style={animationStyle} {...props}>
      {children}
    </div>
  );
}
