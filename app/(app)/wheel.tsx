'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useCallback, type WheelEvent } from 'react';
import { NAV_ITEMS } from '@/src/nav/items';
import { cutAngle, cutFlags, indexOfPath, slotsAround, wrapIndex } from '@/src/nav/wheel';

export function Wheel() {
  const pathname = usePathname();
  const currentIndex = indexOfPath(pathname);
  const [index, setIndex] = useState(currentIndex ?? 0);

  const onWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIndex((i) => wrapIndex(i + (e.deltaY > 0 ? 1 : -1), NAV_ITEMS.length));
  }, []);

  const isHub = currentIndex === null && pathname === '/';
  const slots = slotsAround(index);
  const active = slots[2].item;

  return (
    <>
      {isHub ? (
        <nav className="wheel-capture" role="navigation" aria-label="Setores e ferramentas" onWheel={onWheel}>
          <div className="wheel-disc">
            <div className="wheel-disc-label">{active.group === 'setor' ? 'SETORES' : 'FERRAMENTAS'}</div>
          </div>
          <div className="wheel-labels">
            {slots.map((slot) => {
              const isCurrent = currentIndex !== null && slot.item.slug === NAV_ITEMS[currentIndex].slug;
              return (
                <Link
                  key={slot.item.slug}
                  href={slot.item.href}
                  className="wheel-label"
                  data-group={slot.item.group}
                  data-emphasis={slot.emphasis}
                  aria-current={isCurrent ? 'page' : undefined}
                  style={{ transform: `rotate(${slot.angle}deg) translateX(76px)` }}
                >
                  {slot.item.label}
                </Link>
              );
            })}
            {([0, 1, 2, 3] as const).map((gap) => (
              <span
                key={gap}
                className="wheel-cut"
                data-active={cutFlags(index)[gap]}
                style={{ transform: `rotate(${cutAngle(gap)}deg) translateX(196px)` }}
              />
            ))}
          </div>
        </nav>
      ) : (
        <Link href="/" className="wheel-collapsed" aria-label="Voltar ao hub de setores">
          &lt; SETORES
        </Link>
      )}

      <nav className="wheel-bar" role="navigation" aria-label="Setores e ferramentas">
        {NAV_ITEMS.map((item, i) => (
          <span key={item.slug} className="row" style={{ gap: 0 }}>
            {i > 0 && NAV_ITEMS[i - 1].group !== item.group && <span className="wheel-bar-sep" />}
            <Link href={item.href} data-group={item.group} aria-current={currentIndex === i ? 'page' : undefined}>
              {item.label}
            </Link>
          </span>
        ))}
      </nav>
    </>
  );
}
