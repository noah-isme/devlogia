import type { JSX } from "react";

function serialize(data: unknown) {
  return JSON.stringify(data, null, 0);
}

type JsonLdProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
  id?: string;
};

export function JsonLd({ data, id }: JsonLdProps): JSX.Element {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
      suppressHydrationWarning
    />
  );
}
