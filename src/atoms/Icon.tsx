export function Icon(props: {
  name: string;
  size?: "sm" | "lg" | string;
  color?: string;
  className?: string;
}) {
  const FONT_SIZES = {
    sm: "20px",
    lg: "28px",
  };
  const fontSize =
    props.size && props.size in FONT_SIZES
      ? FONT_SIZES[props.size as keyof typeof FONT_SIZES]
      : props.size;

  return (
    <span
      className={`material-symbols-outlined leading-none m-auto ${props.className ?? ""}`}
      style={{ fontSize, color: props.color }}
    >
      {props.name}
    </span>
  );
}
