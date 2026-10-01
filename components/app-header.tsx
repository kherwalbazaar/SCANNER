import Image from "next/image";
import type { ReactNode } from "react";

type AppHeaderProps = {
  children?: ReactNode;
  className?: string;
  title?: string;
};

export function BrandMark({ title = "JATRA BAZAAR" }: { title?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image
        src="/apple.icon.png"
        alt="Jatra Ticket Scanner"
        width={40}
        height={40}
        className="h-10 w-10 rounded-xl object-cover shadow-xs"
      />
      <div>
        <h1 className="text-sm font-bold leading-tight tracking-wide">
          {title}
        </h1>
        <p className="text-[10px] font-semibold tracking-wider text-indigo-300">
          SCANNER
        </p>
      </div>
    </div>
  );
}

const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200";

export function ProfileAvatar({
  size = 36,
  className,
  src,
  alt = "Scanner profile photo",
}: {
  size?: number;
  className?: string;
  src?: string;
  alt?: string;
}) {
  return (
    <Image
      src={src?.trim() || FALLBACK_AVATAR}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className={
        className ??
        "h-9 w-9 rounded-full border border-indigo-400 object-cover"
      }
    />
  );
}

export function AppHeader({ children, className, title }: AppHeaderProps) {
  return (
    <header
      className={`flex shrink-0 items-center justify-between bg-indigo-950 px-4 pt-6 pb-4 text-white ${className ?? ""}`}
    >
      <BrandMark title={title} />
      <div className="flex items-center gap-2.5">{children}</div>
    </header>
  );
}
