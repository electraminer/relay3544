import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function TooltipWrap(props: {
  children: ReactNode;
  tooltip: ReactNode;
  onClick?: () => void;
}) {
  const { children, tooltip, onClick } = props;
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  return (
    <span
      className="tooltip-wrap"
      ref={wrapRef}
      onMouseEnter={() => setRect(wrapRef.current!.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
      onClick={(e) => {
        onClick?.();
        e.preventDefault();
        setRect(null);
      }}
    >
      {children}
      {rect &&
        createPortal(
          <div
            className="tooltip"
            style={{ top: rect.bottom, right: window.innerWidth - rect.right }}
          >
            {tooltip}
          </div>,
          document.body,
        )}
    </span>
  );
}
