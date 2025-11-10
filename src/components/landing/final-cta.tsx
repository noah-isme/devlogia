import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="py-16">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-secondary/5 p-12 text-center space-y-6">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Mulai menulis hari ini
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Bergabung dengan ribuan kreator yang sudah mempublikasikan konten berkualitas dengan Devlogia.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" className="min-w-[180px]">
            <Link href="/admin/login">Buat Akun Gratis</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-w-[180px]">
            <Link href="/developers">Pelajari Lebih Lanjut</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Gratis selamanya. Tidak perlu kartu kredit.
        </p>
      </div>
    </section>
  );
}
