export {};

import { developerDocs, listDocInternalLinks } from "@/lib/devportal/docs";

async function main() {
  const known = new Set(developerDocs.map((doc) => `/developers/docs/${doc.slug.join("/")}`));
  const links = listDocInternalLinks();
  const broken = links.filter((link) => !known.has(link.to));

  if (broken.length) {
    console.error("Broken developer doc links detected:");
    for (const link of broken) {
      console.error(` - ${link.from} -> ${link.to}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${links.length} internal doc links.`);
}

void main().catch((error) => {
  console.error("Failed to validate docs links", error);
  process.exitCode = 1;
});
