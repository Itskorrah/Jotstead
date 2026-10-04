"use client";
import {
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { XIcon, FileTextIcon } from "@phosphor-icons/react";
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      className={`icon-button ${props.className || ""}`}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}
export { PageIcon } from "./page-icons";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const current = ref.current;
    return () => {
      current?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <IconButton label="Close" onClick={onClose}>
          <XIcon size={19} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
export function Menu({
  children,
  onClose,
  className = "",
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!trigger.current) {
      const focused = document.activeElement as HTMLElement | null;
      if (focused?.matches("button,[role=button]")) trigger.current = focused;
    }
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        trigger.current?.focus();
      }
    };
    const click = (e: PointerEvent) => {
      if (
        !ref.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        onClose();
    };
    document.addEventListener("keydown", close, true);
    document.addEventListener("pointerdown", click);
    return () => {
      document.removeEventListener("keydown", close, true);
      document.removeEventListener("pointerdown", click);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className={`menu ${className}`}
      onKeyDown={(e) => {
        if (
          !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) ||
          (e.target as HTMLElement).matches("input,select,textarea")
        )
          return;
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) || [],
        );
        if (!items.length) return;
        e.preventDefault();
        const current = items.indexOf(e.target as HTMLButtonElement);
        const index =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? items.length - 1
              : (current + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                items.length;
        items[index].focus();
      }}
    >
      {children}
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <FileTextIcon size={32} color="var(--muted)" />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
export function download(
  name: string,
  value: string,
  mime = "application/json",
) {
  const url = URL.createObjectURL(new Blob([value], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
