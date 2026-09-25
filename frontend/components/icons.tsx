/**
 * The small authored icon set.
 *
 * Arrows were Unicode glyphs ("→", "↓") set in whatever font surrounded them,
 * so their weight, size and baseline changed from the serif to the grotesque
 * to the mono. Drawn once here, at one stroke weight, they sit the same
 * everywhere and inherit colour and size from the text around them.
 */

type IconProps = { className?: string; size?: number };

function Svg({ className = '', size = 14, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export function ArrowRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function ArrowDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Svg>
  );
}
