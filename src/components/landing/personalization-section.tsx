export function PersonalizationSection() {
  return (
    <section className="py-16">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-muted/30 p-8 md:p-12">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">
              Feed yang beradaptasi dengan audiens
            </h2>
            <p className="text-muted-foreground">
              Rekomendasi dipersonalisasi dari profil pembaca, topik, dan performa konten. 
              Setiap pengunjung mendapat pengalaman yang relevan dan engaging.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Algoritma pembelajaran berbasis perilaku user</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>A/B testing otomatis untuk headline & CTAs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Segment audiens berdasarkan interest & engagement</span>
              </li>
            </ul>
          </div>
          <div className="rounded-xl bg-muted/50 p-8 flex items-center justify-center min-h-[280px]">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <p className="text-sm font-medium">Personalization Engine</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
