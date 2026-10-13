import "server-only"
import { Resend } from "resend"
import { features, serverEnv } from "@/lib/env.server"

/** Expéditeur de tous les emails Vitalya : le destinataire voit « Vitalya », jamais une adresse brute. */
export const EMAIL_FROM = "Vitalya <newsletter@vitalya.africa>"
/** Les réponses des lecteurs arrivent dans la boîte de la rédaction. */
export const EMAIL_REPLY_TO = "Vitalya <flaugustb@gmail.com>"
/** Destinataire des emails de test de la newsletter. */
export const NEWSLETTER_TEST_EMAIL = "flaugustb@gmail.com"

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

export type SendResult = { sent: number; error: string | null }

/**
 * Envoi par lots de 100 (limite Resend), avec expéditeur et adresse de réponse Vitalya.
 * Ne lève jamais d'exception : retourne le nombre d'emails acceptés et la première erreur.
 */
export async function sendEmailBatch(emails: OutgoingEmail[]): Promise<SendResult> {
  const resendClient = client()
  if (!resendClient) return { sent: 0, error: "Resend n'est pas configuré (RESEND_API_KEY)." }
  if (emails.length === 0) return { sent: 0, error: null }

  let sent = 0
  for (let index = 0; index < emails.length; index += 100) {
    const batch = emails.slice(index, index + 100).map((email) => ({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      headers: email.headers,
    }))
    try {
      const { error } = await resendClient.batch.send(batch)
      if (error) {
        console.error("sendEmailBatch", error.message)
        return { sent, error: error.message }
      }
      sent += batch.length
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("sendEmailBatch", message)
      return { sent, error: message }
    }
  }
  return { sent, error: null }
}

/** Emails transactionnels (bienvenue, alertes, paiement) : un échec ne bloque jamais l'action principale. */
export async function sendEmails(emails: OutgoingEmail[]): Promise<number> {
  return (await sendEmailBatch(emails)).sent
}

export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  return (await sendEmails([email])) === 1
}
