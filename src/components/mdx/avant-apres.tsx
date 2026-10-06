"use client"

import { useId, useState } from "react"
import { isAllowedMediaUrl } from "@/lib/mdx/urls"

/** Comparateur avant / après avec curseur (clavier et tactile via input range). */
export function AvantApres({ avant, apres, legende }: { avant?: string; apres?: string; legende?: string }) {
  const [position, setPosition] = useState(50)
  const id = useId()

  if (!isAllowedMediaUrl(avant) || !isAllowedMediaUrl(apres)) {
    return <p className="my-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Comparaison indisponible (images non autorisées).</p>
  }

  return (
    <figure className="my-10">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={apres} alt="Après" className="absolute inset-0 size-full object-cover" draggable={false} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avant} alt="Avant" className="absolute inset-0 size-full object-cover" draggable={false} />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.4)]" style={{ left: `${position}%` }}>
          <span className="absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm font-bold text-vert-fonce shadow-lg">
            ⇆
          </span>
        </div>
        <span className="absolute top-3 left-3 rounded-full bg-nuit/70 px-3 py-1 text-xs font-semibold text-white">Avant</span>
        <span className="absolute top-3 right-3 rounded-full bg-vert-fonce/85 px-3 py-1 text-xs font-semibold text-white">Après</span>
        <label htmlFor={id} className="sr-only">Position du comparateur avant / après</label>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="absolute inset-0 size-full cursor-ew-resize opacity-0"
        />
      </div>
      {legende && <figcaption className="mt-3 text-center text-sm text-muted-foreground">{legende}</figcaption>}
    </figure>
  )
}
