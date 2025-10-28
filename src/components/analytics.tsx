import Script from "next/script";

import { siteConfig } from "@/lib/seo";

type AttributeMap = Record<string, string>;

function buildLoaderScript(src: string, attributes: AttributeMap) {
  const assignments = Object.entries(attributes)
    .map(([key, value]) => `script.setAttribute(${JSON.stringify(key)}, ${JSON.stringify(value)});`)
    .join("");

  return `(() => {
    if (typeof window === 'undefined') return;
    const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1';
    if (dnt) return;
    const script = document.createElement('script');
    script.src = ${JSON.stringify(src)};
    script.defer = true;
    ${assignments}
    document.body.appendChild(script);
  })();`;
}

export function Analytics() {
  const provider = (process.env.ANALYTICS_PROVIDER ?? "").trim().toLowerCase();
  if (!provider) {
    return null;
  }

  if (provider === "plausible") {
    const scriptUrl = (process.env.ANALYTICS_SCRIPT_URL ?? "https://plausible.io/js/script.js").trim();
    const domain = (process.env.ANALYTICS_DOMAIN ?? "").trim() || new URL(siteConfig.url).hostname;
    const attributes: AttributeMap = {
      "data-domain": domain,
    };

    return (
      <Script
        id="analytics-plausible-loader"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: buildLoaderScript(scriptUrl, attributes) }}
      />
    );
  }

  if (provider === "umami") {
    const scriptUrl = (process.env.ANALYTICS_SCRIPT_URL ?? "").trim();
    const websiteId = (process.env.ANALYTICS_WEBSITE_ID ?? "").trim();
    if (!scriptUrl || !websiteId) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Umami analytics enabled but ANALYTICS_SCRIPT_URL or ANALYTICS_WEBSITE_ID is missing.");
      }
      return null;
    }

    const attributes: AttributeMap = {
      "data-website-id": websiteId,
    };

    if (process.env.ANALYTICS_DOMAIN) {
      attributes["data-domain"] = process.env.ANALYTICS_DOMAIN;
    }

    return (
      <Script
        id="analytics-umami-loader"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: buildLoaderScript(scriptUrl, attributes) }}
      />
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(`Unsupported analytics provider: ${provider}`);
  }

  return null;
}
