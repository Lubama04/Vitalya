import "server-only"
import { Resend } from "resend"
import { features, serverEnv } from "@/lib/env.server"

export type OutgoingEmail = {
  to: string
  subject: string
  html: string
  headers?: Record<string, string>
}

let resend: Resend | null = null

function client(): Resend | null {
  if (!features.email || !serverEnv.RESEND_API_KEY) return null
  resend ??= new Resend(serverEnv.RESEND_API_KEY)
  return resend
}

/**
 * Envoi d'emails transactionnels (bienvenue, nouvel article, paiement).
 * Ne lève jamais d'exception : un email non envoyé ne doit pas bloquer l'action principale.
 * Les envois multiples partent par lots de 100 (limite Resend).
 * Retourne le nombre d'emails acceptés.
 */
export async function sendEmails(emails: OutgoingEmail[]): Promise<number> {
  const resendClient = client()
  if (!resendClient || emails.length === 0) return 0

  let sent = 0
  for (let index = 0; index < emails.length; index += 100) {
    const batch = emails.slice(index, index + 100).map((email) => ({
      from: serverEnv.RESEND_FROM_EMAIL,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      headers: email.headers,
    }))
    try {
      const { error } = await resendClient.batch.send(batch)
      if (error) {
        console.error("sendEmails", error.message)
        break
      }
      sent += batch.length
    } catch (error) {
      console.error("sendEmails", error instanceof Error ? error.message : error)
      break
    }
  }
  return sent
}

export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  return (await sendEmails([email])) === 1
}
