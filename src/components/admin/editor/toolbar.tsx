"use client"

import type { LucideIcon } from "lucide-react"
import {
  Bold,
  Columns2,
  Eye,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  PencilLine,
  Plus,
  SquareArrowOutUpRight,
  Palette,
  SquarePlay as Youtube,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { COLORS, type ColorKey } from "@/lib/mdx/typo"
import { CATALOG, type CatalogItem } from "./catalog"

export type ViewMode = "editeur" | "split" | "apercu"

export type QuickAction =
  | "bold"
  | "italic"
  | "h2"
  | "h3"
  | "ul"
  | "ol"
  | "external-link"
  | "internal-link"
  | "image"
  | "youtube"

const QUICK: { action: QuickAction; label: string; shortcut?: string; icon: LucideIcon }[] = [
  { action: "bold", label: "Gras", shortcut: "Ctrl+B", icon: Bold },
  { action: "italic", label: "Italique", shortcut: "Ctrl+I", icon: Italic },
  { action: "h2", label: "Titre H2", icon: Heading2 },
  { action: "h3", label: "Titre H3", icon: Heading3 },
  { action: "ul", label: "Liste à puces", icon: List },
  { action: "ol", label: "Liste numérotée", icon: ListOrdered },
  { action: "external-link", label: "Lien externe", shortcut: "Ctrl+K", icon: SquareArrowOutUpRight },
  { action: "internal-link", label: "Lien vers un article Vitalya", icon: Link2 },
  { action: "image", label: "Image (import)", icon: ImageIcon },
  { action: "youtube", label: "Vidéo YouTube", icon: Youtube },
]

function ToolButton({
  label,
  shortcut,
  icon: Icon,
  onClick,
  active,
}: {
  label: string
  shortcut?: string
  icon: LucideIcon
  onClick: () => void
  active?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={cn("size-8 text-nuit/80", active && "bg-vert-pale text-vert-fonce")}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        {shortcut && <span className="ml-1 opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

export function EditorToolbar({
  onQuick,
  onColor,
  onCatalog,
  view,
  onViewChange,
  fullscreen,
  onToggleFullscreen,
}: {
  onQuick: (action: QuickAction) => void
  onColor: (color: ColorKey) => void
  onCatalog: (item: CatalogItem) => void
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  fullscreen: boolean
  onToggleFullscreen: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-white px-2 py-1.5" role="toolbar" aria-label="Mise en forme">
      {/* Menu « + » : insertions structurées par catégorie */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" className="h-8 gap-1 bg-orange px-3 text-white hover:bg-orange/90" aria-label="Insérer un bloc">
                <Plus className="size-4" /> Insérer
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Insérer un bloc ou un composant Vitalya</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Composants Vitalya</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {CATALOG.map((group) => (
            <DropdownMenuSub key={group.id}>
              <DropdownMenuSubTrigger className="gap-2">
                <group.icon className="size-4 text-vert-emeraude" /> {group.label}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-80">
                {group.items.map((item) => (
                  <DropdownMenuItem key={item.id} onSelect={() => onCatalog(item)} className="items-start gap-3 py-2" title={item.hint}>
                    <item.icon className="mt-0.5 size-4 shrink-0 text-vert-fonce" />
                    <span className="flex flex-col">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.hint}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      {/* Palette sémantique Vitalya : couleur du texte sélectionné */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-8 text-nuit/80" aria-label="Couleur du texte">
                <Palette className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Couleur du texte (palette Vitalya)</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Palette sémantique Vitalya</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.entries(COLORS) as [ColorKey, (typeof COLORS)[ColorKey]][]).map(([key, color]) => (
            <DropdownMenuItem key={key} onSelect={() => onColor(key)} className="gap-3" title={`${color.label} ${color.hex}`}>
              <span className="size-5 shrink-0 rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: color.hex }} aria-hidden />
              <span className="flex-1">{color.label}</span>
              <span className="font-mono text-[0.7rem] text-muted-foreground">{color.hex}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <p className="px-2 py-1.5 text-[0.7rem] leading-snug text-muted-foreground">
            Crème et Blanc sont destinés aux fonds sombres (encadrés vert ou nuit).
          </p>
        </DropdownMenuContent>
      </DropdownMenu>

      {QUICK.map((tool, index) => (
        <span key={tool.action} className="contents">
          {(index === 2 || index === 4 || index === 6 || index === 8) && <span className="mx-1 h-5 w-px bg-border" aria-hidden />}
          <ToolButton label={tool.label} shortcut={tool.shortcut} icon={tool.icon} onClick={() => onQuick(tool.action)} />
        </span>
      ))}

      <div className="ml-auto flex items-center gap-1">
        <div className="hidden items-center rounded-md border p-0.5 md:flex" role="group" aria-label="Affichage">
          <ToolButton label="Éditeur seul" icon={PencilLine} active={view === "editeur"} onClick={() => onViewChange("editeur")} />
          <ToolButton label="Vue partagée : code | aperçu" icon={Columns2} active={view === "split"} onClick={() => onViewChange("split")} />
          <ToolButton label="Aperçu seul" icon={Eye} active={view === "apercu"} onClick={() => onViewChange("apercu")} />
        </div>
        <ToolButton
          label={fullscreen ? "Quitter le plein écran" : "Plein écran"}
          icon={fullscreen ? Minimize2 : Maximize2}
          onClick={onToggleFullscreen}
        />
      </div>
    </div>
  )
}
