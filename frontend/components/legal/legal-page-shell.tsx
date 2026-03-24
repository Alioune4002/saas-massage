import type { ReactNode } from "react";

type LegalSection = {
  title: string;
  content: ReactNode;
};

export function LegalPageShell({
  eyebrow,
  title,
  introduction,
  sections,
}: {
  eyebrow: string;
  title: string;
  introduction: string;
  sections: LegalSection[];
}) {
  return (
    <main className="px-4 py-10 text-[var(--foreground)] md:px-6 md:py-14">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--background-soft)] p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--foreground-muted)]">
            {introduction}
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[1.8rem] border border-[var(--border)] bg-[var(--background-soft)] p-6 md:p-7"
            >
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                {section.title}
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--foreground-muted)]">
                {section.content}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
