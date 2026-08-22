"use client";

import { useState, useEffect } from "react";

export function useThemeListener() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const getCurrentTheme = (): "light" | "dark" => {
      if (typeof window === "undefined") return "dark";
      const saved = localStorage.getItem("futaba.theme") as "light" | "dark" | null;
      if (saved) return saved;
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    };

    setTheme(getCurrentTheme());

    const handleThemeChange = () => {
      setTheme(getCurrentTheme());
    };

    window.addEventListener("themeChange", handleThemeChange);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class" || mutation.attributeName === "data-theme") {
          handleThemeChange();
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => {
      window.removeEventListener("themeChange", handleThemeChange);
      observer.disconnect();
    };
  }, []);

  return theme;
}
