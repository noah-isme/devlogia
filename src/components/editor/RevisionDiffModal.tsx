"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";

type DiffLine = {
  type: "add" | "delete" | "same";
  line: string;
  lineNumOld?: number;
  lineNumNew?: number;
};

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const diffs: DiffLine[] = [];

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];

    if (oldLine === newLine) {
      if (oldLine !== undefined) {
        diffs.push({ type: "same", line: oldLine, lineNumOld: oldIdx + 1, lineNumNew: newIdx + 1 });
      }
      oldIdx++;
      newIdx++;
    } else if (newLine !== undefined && (!oldLines.slice(oldIdx).includes(newLine) || newLines.slice(newIdx).includes(oldLine))) {
      diffs.push({ type: "add", line: newLine, lineNumNew: newIdx + 1 });
      newIdx++;
    } else if (oldLine !== undefined) {
      diffs.push({ type: "delete", line: oldLine, lineNumOld: oldIdx + 1 });
      oldIdx++;
    }
  }

  return diffs;
}

type RevisionDiffModalProps = {
  isOpen: boolean;
  onClose: () => void;
  revisionTitle: string;
  revisionContent: string;
  currentContent: string;
  onRestore: () => void;
};

export function RevisionDiffModal({
  isOpen,
  onClose,
  revisionTitle,
  revisionContent,
  currentContent,
  onRestore,
}: RevisionDiffModalProps) {
  const diffLines = useMemo(() => {
    if (!isOpen) return [];
    return computeLineDiff(revisionContent, currentContent);
  }, [isOpen, revisionContent, currentContent]);

  const stats = useMemo(() => {
    const adds = diffLines.filter((l) => l.type === "add").length;
    const dels = diffLines.filter((l) => l.type === "delete").length;
    return { adds, dels };
  }, [diffLines]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-5xl flex-col rounded-3xl border border-border bg-background p-6 shadow-2xl">
        <header className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold">Revision Diff View</h2>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                +{stats.adds}
              </span>
              <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
                -{stats.dels}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Comparing revision <span className="font-semibold text-foreground">&quot;{revisionTitle}&quot;</span> against current editor draft.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onRestore}>
              Restore this revision
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        <div className="mt-4 flex-1 overflow-auto rounded-2xl border border-border bg-muted/40 font-mono text-xs leading-relaxed">
          <table className="w-full border-collapse">
            <tbody>
              {diffLines.map((line, idx) => (
                <tr
                  key={idx}
                  className={
                    line.type === "add"
                      ? "bg-emerald-500/15 text-emerald-950 dark:text-emerald-200"
                      : line.type === "delete"
                        ? "bg-red-500/15 text-red-950 dark:text-red-200"
                        : "hover:bg-muted/60 text-muted-foreground"
                  }
                >
                  <td className="w-10 select-none border-r border-border/50 px-2 py-1 text-right text-[10px] text-muted-foreground/60">
                    {line.lineNumOld ?? ""}
                  </td>
                  <td className="w-10 select-none border-r border-border/50 px-2 py-1 text-right text-[10px] text-muted-foreground/60">
                    {line.lineNumNew ?? ""}
                  </td>
                  <td className="w-6 select-none text-center font-bold">
                    {line.type === "add" ? "+" : line.type === "delete" ? "-" : " "}
                  </td>
                  <td className="whitespace-pre-wrap break-all px-3 py-1 font-mono">
                    {line.line}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
