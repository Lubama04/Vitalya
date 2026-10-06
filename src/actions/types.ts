/** Résultat standard d'une Server Action (messages génériques côté client). */
export type ActionState = {
  status: "idle" | "success" | "error"
  message: string
}

export const initialActionState: ActionState = { status: "idle", message: "" }

export function fail(message: string): ActionState {
  return { status: "error", message }
}

export function ok(message: string): ActionState {
  return { status: "success", message }
}
