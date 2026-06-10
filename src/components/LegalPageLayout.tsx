import React from 'react';

type LegalPageLayoutProps = {
  title: string;
  updated: string;
  children: React.ReactNode;
};

export const LegalPageLayout = ({ title, updated, children }: LegalPageLayoutProps) => (
  <div className="px-4 py-6 pb-24 lg:pb-10 max-w-2xl mx-auto w-full">
    <article className="rounded-[24px] border border-baylink-border/40 bg-white/90 shadow-rest backdrop-blur-sm p-6 sm:p-8">
      <header className="mb-6 border-b border-baylink-border/30 pb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-baylink-text leading-tight">{title}</h1>
        <p className="mt-2 text-xs text-baylink-muted">Last updated: {updated}</p>
      </header>
      <div className="space-y-5 text-sm leading-relaxed text-baylink-text-secondary legal-doc">
        {children}
      </div>
    </article>
  </div>
);

export const LegalSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="mb-2 text-base font-semibold text-baylink-text">{title}</h2>
    {children}
  </section>
);

export const LegalP = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 last:mb-0">{children}</p>
);

export const LegalUl = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);
