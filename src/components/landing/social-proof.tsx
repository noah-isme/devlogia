export function SocialProof() {
  return (
    <section className="py-8">
      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          Dipercaya oleh kreator, tim konten, dan startup
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
          {["Startup A", "Team B", "Creator C", "Studio D"].map((name) => (
            <div key={name} className="text-muted-foreground font-medium">
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
