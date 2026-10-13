"use client"

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  Bold,
  FileText,
  FlaskConical,
  ImagePlus,
  Italic,
  Link2,
  Loader2,
  Minus,
  MousePointerClick,
  Newspaper,
  Save,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import { saveNewsletterTemplate, sendNewsletter } from "@/actions/admin"
import { initialActionState } from "@/actions/types"
import { uploadMedia, validateMedia } from "@/components/admin/editor/upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { escapeHtml, newsletterHtml, type NewsletterFormat } from "@/lib/newsletter-email"
import { cn } from "@/lib/utils"

export type Audience = "tous" | "gratuits" | "premium" | "expert"
export type AudienceCounts = Record<Audience, number>
export type ComposerTemplate = { id: string; name: string; format: NewsletterFormat; subject: string; content: string }
export type ComposerArticle = { id: string; title: string; subtitle: string | null; slug: string; cover_image: string | null }

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: "tous", label: "Tous les abonnés", hint: "Toute la liste newsletter" },
  { value: "gratuits", label: "Gratuits uniquement", hint: "Sans abonnement payant (y compris sans compte)" },
  { value: "premium", label: "Premium", hint: "Abonnement Premium actif" },
  { value: "expert", label: "Expert", hint: "Abonnement Expert actif" },
]

type Tool = "article" | "image" | "link" | "cta" | null

/**
 * Compositeur de newsletter : modèles, objet avec suggestions, barre d'outils d'insertion,
 * aperçu HTML en direct (prénom fictif), audience avec effectifs, email de test puis envoi.
 */
export function NewsletterComposer({
  counts,
  emailEnabled,
  siteUrl,
  testEmail,
  templates,
  articles,
}: {
  counts: AudienceCounts
  emailEnabled: boolean
  siteUrl: string
  testEmail: string
  templates: ComposerTemplate[]
  articles: ComposerArticle[]
}) {
  const [state, formAction, pending] = useActionState(sendNewsletter, initialActionState)
  const [audience, setAudience] = useState<Audience>("tous")
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [format, setFormat] = useState<NewsletterFormat>("markdown")
  const [tool, setTool] = useState<Tool>(null)
  const [templateName, setTemplateName] = useState("")
  const [savingTemplate, startSaving] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const subscribers = counts[audience]

  useEffect(() => {
    if (state.status === "success") toast.success(state.message)
    if (state.status === "error") toast.error(state.message)
  }, [state])

  // Aperçu en direct, tel que reçu par un abonné (prénom d'exemple)
  const previewHtml = useMemo(
    () =>
      content.trim()
        ? newsletterHtml({ subject: subject || "Objet de l'email", body: content, siteUrl, unsubscribeUrl: "#", format, firstName: "Aminata" })
        : `<p style="font-family:sans-serif;color:#6B7280;padding:24px">L'aperçu s'affiche ici pendant la rédaction.</p>`,
    [content, subject, siteUrl, format],
  )

  const suggestions = useMemo(() => {
    const latest = articles[0]?.title
    return [
      latest ? `Nouveau sur Vitalya : ${latest}` : null,
      "Vitalya N°01 est en ligne : la beauté africaine au naturel",
      "Votre dose de bien-être de la semaine",
      articles[1]?.title ? `À lire cette semaine : ${articles[1].title}` : null,
    ].filter((item): item is string => Boolean(item))
  }, [articles])

  /** Insère du texte au curseur (ou entoure la sélection). */
  function insert(snippet: string | ((selection: string) => string), block = false) {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart: start, selectionEnd: end } = textarea
    const selection = content.slice(start, end)
    let text = typeof snippet === "function" ? snippet(selection) : snippet
    if (block) {
      const before = content.slice(0, start)
      const prefix = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : ""
      text = `${prefix}${text}\n\n`
    }
    const next = content.slice(0, start) + text + content.slice(end)
    setContent(next)
    requestAnimationFrame(() => {
      textarea.focus()
      const position = start + text.length
      textarea.setSelectionRange(position, position)
    })
  }

  const html = format === "html"
  const absolute = (url: string) => (url.startsWith("http") ? url : `${siteUrl}${url}`)

  // Blocs selon le format : markdown Vitalya ou HTML
  const blocks = {
    image: (src: string, alt: string) =>
      html
        ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="528" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:12px">`
        : `![${alt}](${src})`,
    link: (label: string, href: string) => (html ? `<a href="${escapeHtml(href)}" style="color:#13805A">${escapeHtml(label)}</a>` : `[${label}](${href})`),
    cta: (label: string, href: string, color: "vert" | "orange") =>
      html
        ? `<p style="text-align:center;margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:${color === "orange" ? "#E8813A" : "#0D6B4A"};color:${color === "orange" ? "#1E2532" : "#FFFFFF"};text-decoration:none;font-weight:600;padding:13px 26px;border-radius:10px">${escapeHtml(label)}</a></p>`
        : `[[${label}|${href}|${color}]]`,
    separator: () => (html ? `<hr style="border:0;border-top:1px solid #D6F0E6;margin:28px 0">` : "---"),
    article: (article: ComposerArticle) => {
      const url = `${siteUrl}/articles/${article.slug}`
      const parts = [
        article.cover_image ? blocks.image(absolute(article.cover_image), article.title) : null,
        html ? `<h2 style="font-family:Georgia,serif;color:#0D6B4A">${escapeHtml(article.title)}</h2>` : `## ${article.title}`,
        article.subtitle ? (html ? `<p>${escapeHtml(article.subtitle)}</p>` : article.subtitle) : null,
        blocks.cta("Lire l'article", url, "vert"),
      ]
      return parts.filter(Boolean).join("\n\n")
    },
  }

  function loadTemplate(id: string) {
    const template = templates.find((item) => item.id === id)
    if (!template) return
    if (content.trim() && !window.confirm(`Remplacer le contenu actuel par le modèle « ${template.name} » ?`)) return
    setFormat(template.format)
    setContent(template.content)
    if (template.subject) setSubject(template.subject)
    setTemplateName(template.name)
    toast.success(`Modèle « ${template.name} » chargé`)
  }

  function saveTemplate() {
    startSaving(async () => {
      const result = await saveNewsletterTemplate({ name: templateName, subject, content, format })
      if (result.status === "success") toast.success(result.message)
      else toast.error(result.message)
    })
  }

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border bg-white p-6">
      <input type="hidden" name="format" value={format} />
      {!emailEnabled && (
        <p className="rounded-xl bg-or/15 px-4 py-3 text-sm">
          Resend n&apos;est pas encore configuré (<code>RESEND_API_KEY</code>) : l&apos;envoi est désactivé.
        </p>
      )}

      {/* ─── Modèles ─── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="nl-modele">Partir d&apos;un modèle</Label>
          <select
            id="nl-modele"
            defaultValue=""
            onChange={(event) => {
              loadTemplate(event.target.value)
              event.target.value = ""
            }}
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="">Choisir un modèle…</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.format === "html" ? "HTML" : "éditeur"})
              </option>
            ))}
          </select>
        </div>
        <div className="inline-flex rounded-lg border p-1" role="radiogroup" aria-label="Format du contenu">
          {(["markdown", "html"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={format === value}
              onClick={() => setFormat(value)}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium", format === value ? "bg-vert-fonce text-white" : "text-nuit/70 hover:bg-vert-pale")}
            >
              {value === "markdown" ? "Éditeur Vitalya" : "HTML personnalisé"}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Objet ─── */}
      <div className="space-y-2">
        <Label htmlFor="subject">
          Objet de l&apos;email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="subject"
          name="subject"
          required
          minLength={3}
          maxLength={200}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Le secret de l'huile de baobab 🌿"
          className="h-11"
        />
        <div className="flex flex-wrap gap-1.5" aria-label="Suggestions d'objet">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setSubject(suggestion)}
              className="max-w-full truncate rounded-full border border-vert-emeraude/30 bg-vert-pale/50 px-3 py-1 text-xs text-vert-fonce hover:bg-vert-pale"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Éditeur + aperçu ─── */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="nl-content">Contenu</Label>
          <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 bg-creme/60 p-1.5" role="toolbar" aria-label="Insertion">
            <ToolButton icon={Newspaper} label="Article" active={tool === "article"} onClick={() => setTool(tool === "article" ? null : "article")} />
            <ToolButton icon={ImagePlus} label="Image" active={tool === "image"} onClick={() => setTool(tool === "image" ? null : "image")} />
            <ToolButton icon={Link2} label="Lien" active={tool === "link"} onClick={() => setTool(tool === "link" ? null : "link")} />
            <ToolButton icon={MousePointerClick} label="Bouton" active={tool === "cta"} onClick={() => setTool(tool === "cta" ? null : "cta")} />
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <ToolButton icon={Bold} label="Gras" onClick={() => insert((selection) => (html ? `<strong>${selection || "texte"}</strong>` : `**${selection || "texte"}**`))} />
            <ToolButton icon={Italic} label="Italique" onClick={() => insert((selection) => (html ? `<em>${selection || "texte"}</em>` : `*${selection || "texte"}*`))} />
            <ToolButton icon={Minus} label="Séparateur" onClick={() => insert(blocks.separator(), true)} />
          </div>

          {tool && (
            <ToolPanel
              tool={tool}
              articles={articles}
              onClose={() => setTool(null)}
              onArticle={(article) => insert(blocks.article(article), true)}
              onImage={(src, alt) => insert(blocks.image(src, alt), true)}
              onLink={(label, href) => insert(blocks.link(label, href))}
              onCta={(label, href, color) => insert(blocks.cta(label, href, color), true)}
            />
          )}

          <textarea
            ref={textareaRef}
            id="nl-content"
            name="content"
            required
            rows={22}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              html
                ? "<!doctype html>… Variables : {{prénom}}, {{lien_desabonnement}}"
                : "Bonjour {{prénom}},\n\nCette semaine dans Vitalya…\n\n## Notre dossier\n\n**Huile de baobab** : [lire l'article](https://…)"
            }
            className="-mt-2 w-full rounded-b-lg border border-input p-3 font-mono text-sm focus-visible:ring-2 focus-visible:ring-vert-emeraude focus-visible:outline-none"
          />
          <p className="text-xs text-muted-foreground">
            Variables : <code>{"{{prénom}}"}</code> (retiré proprement s&apos;il est inconnu) et <code>{"{{lien_desabonnement}}"}</code>.{" "}
            {html
              ? "Mode HTML : le document est envoyé tel quel."
              : "Bannière, bouton « Lire le magazine » et lien de désinscription ajoutés automatiquement."}
          </p>
        </div>

        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium">Aperçu (prénom d&apos;exemple : Aminata)</p>
          <iframe
            title="Aperçu de la newsletter"
            srcDoc={previewHtml}
            sandbox=""
            className="h-[760px] w-full rounded-lg border bg-[#FAF7F2]"
          />
        </div>
      </div>

      {/* ─── Audience ─── */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Envoyer à</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((item) => (
            <label
              key={item.value}
              className="flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition-colors has-[:checked]:border-vert-emeraude has-[:checked]:bg-vert-pale/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-vert-emeraude"
            >
              <span className="flex items-center justify-between gap-2 font-medium">
                <span className="flex min-w-0 items-center gap-2">
                  <input
                    type="radio"
                    name="audience"
                    value={item.value}
                    checked={audience === item.value}
                    onChange={() => setAudience(item.value)}
                    className="accent-vert-emeraude"
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{counts[item.value]}</span>
              </span>
              <span className="text-xs text-muted-foreground">{item.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* ─── Actions ─── */}
      <div className="flex flex-wrap items-center gap-3 border-t pt-5">
        <Button type="submit" name="mode" value="test" variant="outline" disabled={pending || !emailEnabled}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />} Envoyer un email test
        </Button>
        <Button
          type="submit"
          name="mode"
          value="envoi"
          disabled={pending || !emailEnabled || subscribers === 0}
          className="bg-orange font-semibold text-nuit hover:bg-orange/90"
          onClick={(event) => {
            if (!window.confirm(`Envoyer « ${subject || "(sans objet)"} » à ${subscribers} abonné·e·s ?`)) event.preventDefault()
          }}
        >
          <Send className="size-4" /> Envoyer à {subscribers} abonné·e·s
        </Button>
        <span className="text-xs text-muted-foreground">Le test part à {testEmail}.</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Nom du modèle"
            aria-label="Nom du modèle"
            className="h-9 w-56"
          />
          <Button type="button" variant="outline" size="sm" disabled={savingTemplate || !content.trim() || templateName.trim().length < 2} onClick={saveTemplate}>
            {savingTemplate ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Enregistrer comme modèle
          </Button>
        </div>
      </div>
    </form>
  )
}

function ToolButton({ icon: Icon, label, onClick, active }: { icon: typeof Bold; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-nuit/80 hover:bg-white hover:text-nuit",
        active && "bg-white text-vert-fonce shadow-sm",
      )}
    >
      <Icon className="size-4" aria-hidden /> {label}
    </button>
  )
}

/** Panneau de saisie de l'outil sélectionné (article, image, lien, bouton). */
function ToolPanel({
  tool,
  articles,
  onClose,
  onArticle,
  onImage,
  onLink,
  onCta,
}: {
  tool: Exclude<Tool, null>
  articles: ComposerArticle[]
  onClose: () => void
  onArticle: (article: ComposerArticle) => void
  onImage: (src: string, alt: string) => void
  onLink: (label: string, href: string) => void
  onCta: (label: string, href: string, color: "vert" | "orange") => void
}) {
  const [text, setText] = useState("")
  const [url, setUrl] = useState("")
  const [color, setColor] = useState<"vert" | "orange">("vert")
  const [uploading, setUploading] = useState(false)
  const httpsOk = /^https:\/\/\S+$/.test(url.trim())

  const done = () => {
    setText("")
    setUrl("")
    onClose()
  }

  async function upload(file: File | undefined) {
    if (!file) return
    const invalid = validateMedia(file, "image")
    if (invalid) return toast.error(invalid)
    setUploading(true)
    try {
      onImage(await uploadMedia(file, "image"), text.trim())
      toast.success("Image importée et insérée")
      done()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import impossible")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="-mt-2 space-y-3 border border-b-0 bg-white p-3 text-sm">
      {tool === "article" && (
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="size-4 text-vert-fonce" aria-hidden />
          <select
            defaultValue=""
            aria-label="Article publié à insérer"
            onChange={(event) => {
              const article = articles.find((item) => item.id === event.target.value)
              if (article) {
                onArticle(article)
                done()
              }
            }}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-white px-2"
          >
            <option value="">Choisir un article publié (titre + image + lien)…</option>
            {articles.map((article) => (
              <option key={article.id} value={article.id}>
                {article.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {tool === "image" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input value={text} onChange={(event) => setText(event.target.value)} placeholder="Texte alternatif" className="h-9 w-44" aria-label="Texte alternatif" />
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 font-medium hover:bg-vert-pale">
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Importer
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} />
          </label>
          <span className="text-muted-foreground">ou</span>
          <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" className="h-9 min-w-0 flex-1" aria-label="Adresse de l'image" />
          <Button type="button" size="sm" disabled={!httpsOk} onClick={() => (onImage(url.trim(), text.trim()), done())}>
            Insérer
          </Button>
        </div>
      )}

      {(tool === "link" || tool === "cta") && (
        <div className="flex flex-wrap items-center gap-2">
          <Input value={text} onChange={(event) => setText(event.target.value)} placeholder={tool === "cta" ? "Texte du bouton" : "Texte du lien"} className="h-9 w-48" aria-label="Texte" />
          <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" className="h-9 min-w-0 flex-1" aria-label="Adresse" />
          {tool === "cta" && (
            <div className="inline-flex rounded-md border p-0.5" role="radiogroup" aria-label="Couleur du bouton">
              {(["vert", "orange"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={color === value}
                  onClick={() => setColor(value)}
                  className={cn("flex items-center gap-1.5 rounded px-2 py-1 text-xs", color === value && "bg-muted font-semibold")}
                >
                  <span className={cn("size-3 rounded-full", value === "vert" ? "bg-vert-fonce" : "bg-orange")} aria-hidden />
                  {value === "vert" ? "Vert" : "Orange"}
                </button>
              ))}
            </div>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!text.trim() || !httpsOk}
            onClick={() => {
              if (tool === "cta") onCta(text.trim(), url.trim(), color)
              else onLink(text.trim(), url.trim())
              done()
            }}
          >
            Insérer
          </Button>
        </div>
      )}
      {(tool === "image" || tool === "link" || tool === "cta") && <p className="text-xs text-muted-foreground">Adresses en https uniquement.</p>}
    </div>
  )
}
