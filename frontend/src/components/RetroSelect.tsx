import { useEffect, useId, useRef, useState } from 'react';

export interface RetroSelectOption {
  value: string;
  label: string;
}

interface RetroSelectProps {
  value: string;
  options: RetroSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}

/**
 * A custom dropdown that replaces the native `<select>` for the toolbar.
 *
 * Native `<select>` option lists are rendered by the OS (especially on macOS),
 * which ignores CSS like `font-size`/`font-family` on `<option>` — so the open
 * list never matched the closed box. This control renders its own option list,
 * giving the open menu the exact size/colour/font as the closed box. It keeps
 * basic listbox keyboard behaviour (arrows, Enter, Escape) and closes on
 * outside click or blur.
 */
export function RetroSelect({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
}: RetroSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.findIndex((o) => o.value === value)),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const openMenu = () => {
    if (disabled) return;
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const choose = (index: number) => {
    const opt = options[index];
    if (opt) onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) openMenu();
        else setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) openMenu();
        else setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open) choose(activeIndex);
        else openMenu();
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className="retro-select" ref={rootRef}>
      <button
        type="button"
        className="retro-select-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="retro-select-value">{selected?.label ?? ''}</span>
        <span className="retro-select-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul className="retro-select-list" role="listbox" id={listId}>
          {options.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={
                'retro-select-option' +
                (i === activeIndex ? ' is-active' : '') +
                (opt.value === value ? ' is-selected' : '')
              }
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => choose(i)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
