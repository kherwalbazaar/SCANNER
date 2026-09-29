import Image from "next/image";
import type { ReactNode } from "react";
import { QrCode } from "lucide-react";

type AppHeaderProps = {
  children?: ReactNode;
  className?: string;
};

export function BrandMark({ iconClassName }: { iconClassName?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-xl border border-indigo-700 bg-indigo-900 p-2">
        <QrCode
          className={iconClassName ?? "h-5 w-5 text-indigo-300"}
          strokeWidth={2}
        />
      </div>
      <div>
        <h1 className="text-sm font-bold leading-tight tracking-wide">
          JATRA TICKET
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

export function AppHeader({ children, className }: AppHeaderProps) {
  return (
    <header
      className={`flex shrink-0 items-center justify-between bg-indigo-950 px-4 pt-6 pb-4 text-white ${className ?? ""}`}
    >
      <BrandMark />
      <div className="flex items-center gap-2.5">{children}</div>
    </header>
  );
}
