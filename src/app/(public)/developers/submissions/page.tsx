import { SubmissionsConsole } from "@/components/devportal/SubmissionsConsole";

export default function SubmissionsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Submission console</h1>
        <p className="text-sm text-muted-foreground">
          Draft plugin and AI extension submissions, manage manifests, and monitor review status in real-time.
        </p>
      </header>
      <SubmissionsConsole />
    </div>
  );
}
