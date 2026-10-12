import type { ReactNode } from "react";

export function MemoriesShell({ children }: { children: ReactNode }) {
  return (
    <div className="memories-root min-h-screen bg-[#1a1510] text-[#F4EDE3]">
      <style>{`
        .memories-root { font-family: "Nunito Sans", system-ui, sans-serif; }
        .memories-display { font-family: Fraunces, Georgia, serif; }
      `}</style>
      {children}
    </div>
  );
}
