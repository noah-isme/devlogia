import { NextResponse } from "next/server";

const provider = (process.env.NEWSLETTER_PROVIDER ?? "").trim().toLowerCase();

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please provide a valid email." }, { status: 400 });
  }

  if (!provider) {
    return NextResponse.json({ error: "Newsletter provider is not configured." }, { status: 503 });
  }

  try {
    if (provider === "buttondown") {
      const apiKey = process.env.BUTTONDOWN_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "Buttondown API key missing." }, { status: 500 });
      }

      const response = await fetch("https://api.buttondown.email/v1/subscribers", {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok && response.status !== 409) {
        const detail = await response.text();
        console.error("Buttondown subscription failed", detail);
        return NextResponse.json({ error: "Unable to subscribe right now." }, { status: 502 });
      }
    } else if (provider === "resend") {
      const apiKey = process.env.RESEND_API_KEY;
      const audienceId = process.env.RESEND_AUDIENCE_ID;
      if (!apiKey || !audienceId) {
        return NextResponse.json({ error: "Resend configuration incomplete." }, { status: 500 });
      }

      const response = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok && response.status !== 409) {
        const detail = await response.text();
        console.error("Resend subscription failed", detail);
        return NextResponse.json({ error: "Unable to subscribe right now." }, { status: 502 });
      }
    } else {
      return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Newsletter subscription failed", error);
    return NextResponse.json({ error: "Unable to subscribe right now." }, { status: 500 });
  }
}
