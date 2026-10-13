import { NewsletterComposer, type AudienceCounts, type ComposerArticle, type ComposerTemplate } from "@/components/admin/newsletter-composer"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/lib/constants"
import { EMAIL_FROM, NEWSLETTER_TEST_EMAIL } from "@/lib/email"
import { siteUrl } from "@/lib/env"
import { features } from "@/lib/env.server"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Newsletter" }

export default async function NewsletterPage() {
  const supabase = await createClient()
  const [{ data: countRow }, { data: history }, { data: templates }, { data: articles }] = await Promise.all([
    supabase.rpc("newsletter_audience_counts").maybeSingle(),
    supabase
      .from("newsletters")
      .select("id, subject, sent_at, recipients_count, audience")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("newsletter_templates").select("id, name, format, subject, content").order("name"),
    // Articles publiés (insertion dans la newsletter et suggestions d'objet)
    supabase
      .from("articles")
      .select("id, title, subtitle, slug, cover_image")
      .eq("published", true)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(50),
  ])
  const counts: AudienceCounts = countRow ?? { tous: 0, gratuits: 0, premium: 0, expert: 0 }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-nuit">Newsletter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {counts.tous} abonné(s) actif(s) · expéditeur « {EMAIL_FROM} » · tests envoyés à {NEWSLETTER_TEST_EMAIL}
        </p>
      </header>

      <NewsletterComposer
        counts={counts}
        emailEnabled={features.email}
        siteUrl={siteUrl}
        testEmail={NEWSLETTER_TEST_EMAIL}
        templates={(templates ?? []) as ComposerTemplate[]}
        articles={(articles ?? []) as ComposerArticle[]}
      />

      <section aria-labelledby="titre-historique">
        <h2 id="titre-historique" className="mb-4 text-xl font-bold">Historique des envois</h2>
        <div className="overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Objet</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Envoyée le</TableHead>
                <TableHead className="text-right">Destinataires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(history ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.subject}</TableCell>
                  <TableCell className="capitalize">{item.audience}</TableCell>
                  <TableCell>{formatDate(item.sent_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.recipients_count}</TableCell>
                </TableRow>
              ))}
              {(history ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Aucune newsletter envoyée.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
