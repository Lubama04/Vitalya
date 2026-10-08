import { NewsletterComposer } from "@/components/admin/newsletter-composer"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/lib/constants"
import { features } from "@/lib/env.server"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Newsletter" }

export default async function NewsletterPage() {
  const supabase = await createClient()
  const [{ count }, { data: history }] = await Promise.all([
    supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).is("unsubscribed_at", null),
    supabase.from("newsletters").select("id, subject, sent_at, recipients_count").order("created_at", { ascending: false }).limit(20),
  ])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-nuit">Newsletter</h1>
        <p className="mt-1 text-sm text-muted-foreground">{count ?? 0} abonné(s) actif(s) · envoi via Resend</p>
      </header>

      <NewsletterComposer subscribers={count ?? 0} emailEnabled={features.email} />

      <section aria-labelledby="titre-historique">
        <h2 id="titre-historique" className="mb-4 text-xl font-bold">Historique des envois</h2>
        <div className="overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Objet</TableHead>
                <TableHead>Envoyée le</TableHead>
                <TableHead className="text-right">Destinataires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(history ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.subject}</TableCell>
                  <TableCell>{formatDate(item.sent_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.recipients_count}</TableCell>
                </TableRow>
              ))}
              {(history ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Aucune newsletter envoyée.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
