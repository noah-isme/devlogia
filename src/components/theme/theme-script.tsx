import Script from "next/script";

const script = `(() => {
  try {
    const storageKey = "devlogia-theme";
    const root = document.documentElement;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark") {
      root.dataset.theme = stored;
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    root.dataset.theme = media.matches ? "dark" : "light";
  } catch (error) {
    console.warn("Theme fallback", error);
    document.documentElement.dataset.theme = "light";
  }
})();`;

export function ThemeScript() {
  return (
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script
      id="theme-initializer"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
