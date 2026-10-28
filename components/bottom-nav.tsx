"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Armchair, Clock, House, Ticket, User } from "lucide-react";

export type NavKey = "home" | "events" | "seats" | "history" | "profile";

const ITEMS: { key: NavKey; href: string; label: string; Icon: typeof House }[] =
  [
    { key: "events", href: "/events", label: "Events", Icon: Ticket },
    { key: "seats", href: "/seats", label: "Seats", Icon: Armchair },
    { key: "home", href: "/", label: "Home", Icon: House },
    { key: "history", href: "/history", label: "History", Icon: Clock },
    { key: "profile", href: "/profile", label: "Profile", Icon: User },
  ];

export function BottomNav({ active }: { active?: NavKey }) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLElement>(null);
  const borderRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const currentPage: NavKey =
    active ??
    (pathname.startsWith("/events")
      ? "events"
      : pathname.startsWith("/seats")
        ? "seats"
        : pathname.startsWith("/history")
          ? "history"
          : pathname.startsWith("/profile")
            ? "profile"
            : "home");

  useLayoutEffect(() => {
    const updatePositions = () => {
      const menu = menuRef.current;
      if (!menu) return;

      const activeItem = menu.querySelector<HTMLElement>(".menu__item.active");
      if (!activeItem) return;

      const menuRect = menu.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();

      if (borderRef.current) {
        const left = Math.floor(
          itemRect.left -
            menuRect.left -
            (borderRef.current.offsetWidth - itemRect.width) / 2,
        );
        borderRef.current.style.transform = `translate3d(${left}px, 0, 0)`;
      }

      if (glowRef.current) {
        const centerX = itemRect.left - menuRect.left + itemRect.width / 2;
        glowRef.current.style.transform = `translate3d(${centerX - 28}px, 0, 0)`;
      }
    };

    updatePositions();
    window.addEventListener("resize", updatePositions);
    return () => window.removeEventListener("resize", updatePositions);
  }, [currentPage]);

  return (
    <div className="nav-wrapper">
      <nav className="menu" ref={menuRef} aria-label="Main navigation">
        <div className="glow-orb" ref={glowRef} aria-hidden="true">
          <div className="glow-orb__core" />
          <div className="glow-orb__ring" />
          <div className="glow-orb__pulse" />
        </div>

        {ITEMS.map(({ key, href, label, Icon }) => {
          const isActive = currentPage === key;

          return (
            <Link
              key={key}
              href={href}
              title={label}
              aria-current={isActive ? "page" : undefined}
              className={`menu__item${isActive ? " active" : ""}`}
            >
              <span className="icon-wrapper">
                <Icon className="nav-icon" strokeWidth={2.2} />
              </span>
              <span className="menu__label">{label}</span>
            </Link>
          );
        })}

        <div className="menu__border" ref={borderRef} aria-hidden="true" />
      </nav>

      <div className="svg-container" aria-hidden="true">
        <svg viewBox="0 0 202.9 45.5">
          <clipPath
            id="scanner-menu"
            clipPathUnits="objectBoundingBox"
            transform="scale(0.0049285362247413 0.021978021978022)"
          >
            <path d="M6.7,45.5c5.7,0.1,14.1-0.4,23.3-4c5.7-2.3,9.9-5,18.1-10.5c10.7-7.1,11.8-9.2,20.6-14.3c5-2.9,9.2-5.2,15.2-7 c7.1-2.1,13.3-2.3,17.6-2.1c4.2-0.2,10.5,0.1,17.6,2.1c6.1,1.8,10.2,4.1,15.2,7c8.8,5,9.9,7.1,20.6,14.3c8.3,5.5,12.4,8.2,18.1,10.5 c9.2,3.6,17.6,4.2,23.3,4H6.7z" />
          </clipPath>
        </svg>
      </div>
    </div>
  );
}
