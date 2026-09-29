import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  className?: string;
};

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div
      className={cn(
        "relative flex h-dvh w-full flex-col overflow-hidden bg-slate-50",
        className,
      )}
    >
      {children}
    </div>
  );
}
