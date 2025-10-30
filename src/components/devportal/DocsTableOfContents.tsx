import { cn } from "@/lib/utils";

type TocEntry = {
  id: string;
  title: string;
  level: number;
};

type DocsTableOfContentsProps = {
  entries: TocEntry[];
};

export function DocsTableOfContents({ entries }: DocsTableOfContentsProps) {
  if (!entries.length) {
    return null;
  }

  return (
    <aside className="not-prose rounded-lg border border-border bg-muted/40 p-4" aria-label="Table of contents">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this page</p>
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        {entries.map((entry) => (
          <li key={entry.id} className={cn(entry.level === 3 && "pl-4", entry.level >= 4 && "pl-6")}> 
            <a href={`#${entry.id}`} className="hover:text-foreground hover:underline">
              {entry.title}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
