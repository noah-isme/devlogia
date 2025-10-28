import { Writable } from "node:stream";

export type LogtailTransportOptions = {
  token: string;
  endpoint?: string;
};

const DEFAULT_ENDPOINT = "https://in.logtail.com";

export default async function logtailTransport(options: LogtailTransportOptions) {
  const token = options.token;
  if (!token) {
    throw new Error("Logtail transport requires a token");
  }

  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;

  return new Writable({
    async write(chunk, _encoding, callback) {
      try {
        await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: chunk,
        });
        callback();
      } catch (error) {
        // Swallow transport errors so logging failures do not break requests.
        console.error("Logtail transport error", error);
        callback();
      }
    },
    objectMode: false,
  });
}
