export async function triggerOutbound(event: string, payload: unknown) {
  const urlsRaw = process.env.WEBHOOKS_OUTBOUND_URLS || "[]";
  let urls: string[] = [];

  try {
    urls = JSON.parse(urlsRaw);
  } catch (error) {
    console.error("Invalid WEBHOOKS_OUTBOUND_URLS configuration", error);
    return;
  }

  for (const url of urls) {
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Devlogia-Event": event,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error(`Failed to trigger webhook for ${url}`, error);
    }
  }
}
