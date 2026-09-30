"use client";

import Link from "next/link";
import { Clock, House, Ticket, User } from "lucide-react";

import { cn } from "@/lib/utils";

export type NavKey = "home" | "events" | "history" | "profile";

const ITEMS: { key: NavKey; href: string; label: string; Icon: typeof House }[] =
  [
    { key: "home", href: "/", label: "Home", Icon: House },
    { key: "events", href: "/events", label: "Events", Icon: Ticket },
    { key: "history", href: "/history", label: "History", Icon: Clock },
    { key: "profile", href: "/profile", label: "Profile", Icon: User },
  ];

export function BottomNav({ active }: { active: NavKey }) {
  return (
    <nav className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between border-t border-slate-200 bg-white px-5 py-2">
      {ITEMS.map(({ key, href, label, Icon }) => {
        const isActive = active === key;

        return (
          <Link
            key={key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center transition-colors",
              isActive
                ? "text-indigo-900"
                : "text-slate-400 hover:text-slate-600",
            )}
          >
            <Icon
              className="h-[18px] w-[18px]"
              strokeWidth={isActive ? 2.5 : 2}
            />
            <span
              className={cn(
                "mt-0.5 text-[10px]",
                isActive ? "font-semibold" : "font-medium",
              )}
            >
              {label}
            </span>
            {isActive ? (
              <span className="absolute -bottom-2 h-1 w-8 rounded-t-full bg-indigo-900" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
