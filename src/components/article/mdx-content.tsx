import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { compileMDX } from "next-mdx-remote/rsc"
import { Lightbulb, Quote } from "lucide-react"

// ─── Composants MDX autorisés dans les articles ───────────────

function Encart({ titre, children }: { titre?: string; children?: ReactNode }) {
  return (
    <aside className="not-prose my-8 rounded-2xl border border-vert-emeraude/20 bg-vert-pale/60 p-6">
      <p className="mb-2 flex items-center gap-2 font-heading text-lg font-bold text-vert-fonce">
        <Lightbulb className="size-5 text-orange" aria-hidden />
        {titre ?? "Bon à savoir"}
      </p>
      <div className="space-y-3 text-[1rem] leading-relaxed text-nuit/85 [&_strong]:text-vert-fonce">
        {children}
      </div>
    </aside>
  )
}

function Citation({ auteur, children }: { auteur?: string; children?: ReactNode }) {
  return (
    <figure className="my-10 border-l-4 border-orange pl-6">
      <Quote className="mb-2 size-6 text-orange" aria-hidden />
      <blockquote className="font-heading text-2xl leading-snug italic text-vert-fonce">
        {children}
      </blockquote>
      {auteur && <figcaption className="mt-3 text-sm text-muted-foreground">— {auteur}</figcaption>}
    </figure>
  )
}

/** Liens : seuls http(s), mailto et chemins internes sont rendus cliquables. */
function SafeLink({ href, children, ...rest }: ComponentPropsWithoutRef<"a">) {
  const safe = typeof href === "string" && /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href)
  if (!safe) return <span>{children}</span>
  const external = /^https?:\/\//i.test(href)
  return (
    <a
      {...rest}
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
    >
      {children}
    </a>
  )
}

const components = { Encart, Citation, a: SafeLink }

// ─── Plugin remark : liste blanche des éléments JSX ───────────
// Défense en profondeur (en plus de blockJS) : tout élément JSX non
// autorisé (<script>, <iframe>, <div onClick…>) est supprimé, ainsi que
// les imports/exports et expressions JavaScript.

type MdAttribute = { type: string; name?: string; value?: unknown }
type MdNode = {
  type: string
  name?: string | null
  attributes?: MdAttribute[]
  children?: MdNode[]
}

const ALLOWED_JSX: Record<string, readonly string[]> = {
  Encart: ["titre"],
  Citation: ["auteur"],
}
const FORBIDDEN_TYPES = new Set(["mdxjsEsm", "mdxFlowExpression", "mdxTextExpression", "html"])

function sanitizeTree(node: MdNode): void {
  if (!node.children) return
  node.children = node.children.filter((child) => {
    if (FORBIDDEN_TYPES.has(child.type)) return false
    if (child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement") {
      const allowedAttributes = child.name ? ALLOWED_JSX[child.name] : undefined
      if (!allowedAttributes) return false
      // Uniquement des attributs texte autorisés (pas d'expressions)
      child.attributes = (child.attributes ?? []).filter(
        (attribute) =>
          attribute.type === "mdxJsxAttribute" &&
          typeof attribute.name === "string" &&
          allowedAttributes.includes(attribute.name) &&
          typeof attribute.value === "string",
      )
    }
    return true
  })
  node.children.forEach(sanitizeTree)
}

function remarkJsxAllowlist() {
  return (tree: MdNode) => sanitizeTree(tree)
}

export async function MdxContent({ source }: { source: string }) {
  try {
    const { content } = await compileMDX({
      source,
      components,
      options: {
        blockJS: true,
        blockDangerousJS: true,
        mdxOptions: { remarkPlugins: [remarkJsxAllowlist] },
      },
    })
    return content
  } catch (error) {
    // MDX invalide : on affiche le texte brut plutôt que de casser la page
    console.error("MDX compile error", error instanceof Error ? error.message : error)
    return (
      <div className="whitespace-pre-line">{source}</div>
    )
  }
}
