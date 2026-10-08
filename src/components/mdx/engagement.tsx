"use client"

import { Children, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Check, CircleHelp, Gauge, Pause, Play, RotateCcw, Trophy, Vote, Volume2, VolumeX, X } from "lucide-react"
import { slugify } from "@/lib/constants"
import { isAllowedMediaUrl } from "@/lib/mdx/urls"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════════
// Composants MDX d'engagement : Quiz, Sondage, lecteur Audio.
// ═══════════════════════════════════════════════════════════════

/** Texte brut d'un nœud React (libellés d'options). */
function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join("")
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children)
  return ""
}

// ─── Quiz ─────────────────────────────────────────────────────

/** Réponse proposée (à placer dans <Question>). */
export function Reponse({ children }: { correcte?: string; explication?: string; children?: ReactNode }) {
  return <>{children}</>
}

/** Question du quiz (contient des <Reponse>). */
export function Question({ children }: { texte?: string; children?: ReactNode }) {
  return <>{children}</>
}

type QuizAnswer = { content: ReactNode; correct: boolean; explication?: string }
type QuizQuestion = { texte: string; answers: QuizAnswer[] }

function parseQuiz(children: ReactNode): QuizQuestion[] {
  return Children.toArray(children).flatMap((child): QuizQuestion[] => {
    if (!isValidElement<{ texte?: string; children?: ReactNode }>(child) || typeof child.props.texte !== "string") return []
    const answers = Children.toArray(child.props.children).flatMap((answer): QuizAnswer[] => {
      if (!isValidElement<{ correcte?: string; explication?: string; children?: ReactNode }>(answer)) return []
      if (answer.props.correcte === undefined && answer.props.explication === undefined && !answer.props.children) return []
      return [
        {
          content: answer.props.children,
          correct: answer.props.correcte === "true" || answer.props.correcte === "oui",
          explication: answer.props.explication,
        },
      ]
    })
    return answers.length >= 2 ? [{ texte: child.props.texte, answers }] : []
  })
}

export function Quiz({ titre, children }: { titre?: string; children?: ReactNode }) {
  const questions = useMemo(() => parseQuiz(children), [children])
  // Réponse choisie par question (aucune sauvegarde : simple jeu de lecture)
  const [choices, setChoices] = useState<(number | null)[]>(() => questions.map(() => null))

  // Le contenu change réellement (aperçu de l'éditeur) : on repart de zéro
  const signature = questions.map((question) => `${question.texte}#${question.answers.length}`).join("|")
  useEffect(() => {
    setChoices(signature.split("|").map(() => null))
  }, [signature])

  if (questions.length === 0) return null

  const answered = choices.filter((choice) => choice !== null).length
  const score = choices.reduce<number>((total, choice, index) => total + (choice !== null && questions[index]?.answers[choice]?.correct ? 1 : 0), 0)
  const finished = answered === questions.length
  const ratio = score / questions.length

  return (
    <section className="quiz my-12 overflow-hidden rounded-3xl border-2 border-vert-fonce/15 bg-white" aria-label={titre ?? "Quiz"}>
      <header className="flex items-center gap-3 bg-vert-fonce px-6 py-4 text-white">
        <CircleHelp className="size-5 text-or" aria-hidden />
        <p className="m-0! flex-1 font-heading text-lg font-bold">{titre ?? "Testez vos connaissances"}</p>
        <span className="text-xs font-semibold text-white/75 tabular-nums">
          {answered}/{questions.length}
        </span>
      </header>

      <ol className="m-0! list-none! space-y-8 p-6! sm:p-8!">
        {questions.map((question, qIndex) => {
          const choice = choices[qIndex]
          const locked = choice !== null
          return (
            <li key={qIndex} className="m-0!">
              <p className="m-0! mb-3! font-semibold text-nuit">
                <span className="mr-2 text-orange-fonce">{qIndex + 1}.</span>
                {question.texte}
              </p>
              <div className="grid gap-2" role="group" aria-label={`Réponses à la question ${qIndex + 1}`}>
                {question.answers.map((answer, aIndex) => {
                  const selected = choice === aIndex
                  const showCorrect = locked && answer.correct
                  const showWrong = locked && selected && !answer.correct
                  return (
                    <button
                      key={aIndex}
                      type="button"
                      disabled={locked}
                      aria-pressed={selected}
                      onClick={() => setChoices((current) => current.map((value, index) => (index === qIndex ? aIndex : value)))}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-[0.98rem] transition-colors duration-200 [&_p]:m-0",
                        !locked && "border-border hover:border-vert-emeraude hover:bg-vert-pale/40",
                        showCorrect && "border-vert-emeraude bg-vert-pale text-vert-fonce",
                        showWrong && "border-red-300 bg-red-50 text-red-800",
                        locked && !showCorrect && !showWrong && "border-border opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                          showCorrect ? "border-vert-emeraude bg-vert-emeraude text-white" : showWrong ? "border-red-400 bg-red-400 text-white" : "border-current text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        {showCorrect ? <Check className="size-3.5" /> : showWrong ? <X className="size-3.5" /> : String.fromCharCode(65 + aIndex)}
                      </span>
                      <span className="flex-1">{answer.content}</span>
                    </button>
                  )
                })}
              </div>
              {locked && (
                <div
                  role="status"
                  className={cn(
                    "mt-3 rounded-xl px-4 py-3 text-sm motion-safe:animate-in motion-safe:fade-in",
                    question.answers[choice]?.correct ? "bg-vert-pale/70 text-vert-fonce" : "bg-red-50 text-red-800",
                  )}
                >
                  <strong>{question.answers[choice]?.correct ? "Bonne réponse !" : "Pas tout à fait."}</strong>{" "}
                  {question.answers[choice]?.explication ?? question.answers.find((answer) => answer.correct)?.explication}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {finished && (
        <footer className="flex flex-wrap items-center gap-4 border-t bg-creme/70 px-6 py-5 motion-safe:animate-in motion-safe:fade-in">
          <Trophy className={cn("size-8", ratio >= 0.75 ? "text-or" : ratio >= 0.5 ? "text-vert-emeraude" : "text-muted-foreground")} aria-hidden />
          <div className="flex-1">
            <p className="m-0! font-heading text-2xl font-bold text-vert-fonce">
              Score : {score} / {questions.length}
            </p>
            <p className="m-0! text-sm text-muted-foreground">
              {ratio === 1 ? "Parfait, vous êtes incollable !" : ratio >= 0.5 ? "Très bien, encore un petit effort." : "Relisez l'article et retentez votre chance."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setChoices(questions.map(() => null))}
            className="flex items-center gap-1.5 rounded-full border border-vert-fonce/30 px-4 py-2 text-sm font-semibold text-vert-fonce hover:bg-vert-pale"
          >
            <RotateCcw className="size-4" /> Recommencer
          </button>
        </footer>
      )}
    </section>
  )
}

// ─── Sondage ──────────────────────────────────────────────────

/** Option de sondage (à placer dans <Sondage>). */
export function SondageOption({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

type PollOption = { id: string; label: string }

export function Sondage({ question, articleId, children }: { question?: string; articleId?: string; children?: ReactNode }) {
  const pollKey = slugify(question ?? "").slice(0, 80).replace(/-+$/g, "") || "sondage"
  const options: PollOption[] = useMemo(() => {
    const seen = new Set<string>()
    return Children.toArray(children).flatMap((child): PollOption[] => {
      if (!isValidElement<{ children?: ReactNode }>(child)) return []
      const label = nodeText(child.props.children).trim()
      const slug = slugify(label).slice(0, 80).replace(/-+$/g, "")
      if (!label || !slug || seen.has(slug)) return []
      seen.add(slug)
      return [{ id: `${pollKey}::${slug}`, label }]
    })
  }, [children, pollKey])

  const storageKey = articleId ? `vitalya:vote:${articleId}:${pollKey}` : null
  const [myVote, setMyVote] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alreadyVoted, setAlreadyVoted] = useState(false)

  // Déjà voté sur cet appareil : on affiche directement les résultats
  useEffect(() => {
    if (!storageKey || !articleId) return
    let saved: string | null = null
    try {
      saved = localStorage.getItem(storageKey)
    } catch {
      saved = null
    }
    if (!saved) return
    setMyVote(saved)
    void createClient()
      .from("votes")
      .select("option_id, count")
      .eq("article_id", articleId)
      .like("option_id", `${pollKey}::%`)
      .then(({ data }) => setCounts(Object.fromEntries((data ?? []).map((row) => [row.option_id, row.count]))))
  }, [storageKey, articleId, pollKey])

  async function vote(option: PollOption) {
    if (!articleId || pending || myVote) return
    setPending(true)
    setError(null)
    const { data, error: rpcError } = await createClient().rpc("cast_vote", { p_article_id: articleId, p_option_id: option.id })
    setPending(false)
    if (rpcError) {
      setError("Vote impossible pour le moment.")
      return
    }
    // Vote refusé par le serveur : ce lecteur avait déjà voté (autre onglet, stockage effacé…)
    const accepted = data?.[0]?.accepted ?? true
    setAlreadyVoted(!accepted)
    if (accepted) setMyVote(option.id)
    setCounts(Object.fromEntries((data ?? []).map((row) => [row.option_id, row.count])))
    try {
      if (storageKey) localStorage.setItem(storageKey, accepted ? option.id : "deja-vote")
    } catch {
      // ignoré
    }
  }

  if (options.length < 2) return null
  const total = counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : 0

  return (
    <section className="sondage my-12 rounded-3xl border bg-gradient-to-br from-vert-pale/50 to-white p-6 sm:p-8" aria-label="Sondage">
      <p className="m-0! mb-1! flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-orange-fonce uppercase">
        <Vote className="size-4" aria-hidden /> Sondage
      </p>
      <p className="m-0! mb-5! font-heading text-xl font-bold text-nuit">{question}</p>

      <div className="grid gap-2.5">
        {options.map((option) => {
          const count = counts?.[option.id] ?? 0
          const percent = total > 0 ? Math.round((count / total) * 100) : 0
          const mine = myVote === option.id
          return counts ? (
            <div key={option.id} className={cn("relative overflow-hidden rounded-xl border bg-white px-4 py-3", mine && "border-vert-emeraude")}>
              <div
                aria-hidden
                className={cn("absolute inset-y-0 left-0 transition-[width] duration-700 ease-out", mine ? "bg-vert-emeraude/20" : "bg-vert-pale")}
                style={{ width: `${percent}%` }}
              />
              <div className="relative flex items-center gap-3 text-sm">
                <span className="flex-1 font-medium text-nuit">
                  {option.label}
                  {mine && <span className="ml-2 text-xs font-semibold text-vert-emeraude">(votre choix)</span>}
                </span>
                <span className="font-heading text-lg font-bold text-vert-fonce tabular-nums">{percent} %</span>
              </div>
            </div>
          ) : (
            <button
              key={option.id}
              type="button"
              disabled={!articleId || pending}
              onClick={() => void vote(option)}
              className="rounded-xl border-2 border-border bg-white px-4 py-3 text-left text-sm font-medium text-nuit transition-colors hover:border-vert-emeraude hover:bg-vert-pale/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <p className="m-0! mt-4! text-xs text-muted-foreground" role="status">
        {error ??
          (!articleId
            ? "Aperçu : le vote est actif une fois l'article publié."
            : counts
              ? alreadyVoted
                ? `Vous avez déjà voté à ce sondage · ${total} vote${total > 1 ? "s" : ""}`
                : `${total} vote${total > 1 ? "s" : ""} · merci pour votre participation !`
              : "Un clic pour voter, les résultats s'affichent ensuite.")}
      </p>
    </section>
  )
}

// ─── Lecteur audio ────────────────────────────────────────────

const SPEEDS = [1, 1.5, 2] as const

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
}

export function AudioLecteur({ src, titre }: { src?: string; titre?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(0)

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[speedIndex] ?? 1
  }, [speedIndex])
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume
    audioRef.current.muted = muted
  }, [volume, muted])

  if (!isAllowedMediaUrl(src)) {
    return <p className="my-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Audio indisponible (source non autorisée).</p>
  }

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  return (
    <figure className="audio-player my-10 rounded-2xl border bg-white p-4 shadow-sm sm:p-5" aria-label={titre ?? "Version audio"}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Lecture"}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-vert-fonce text-white shadow-md transition-transform hover:scale-105"
        >
          {playing ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <figcaption className="mb-1.5 truncate text-sm font-semibold text-nuit">{titre ?? "Écouter l'article"}</figcaption>
          <div className="flex items-center gap-3">
            <span className="w-10 text-xs text-muted-foreground tabular-nums">{formatTime(current)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={current}
              onChange={(event) => {
                if (audioRef.current) audioRef.current.currentTime = Number(event.target.value)
              }}
              aria-label="Progression"
              className="h-1.5 flex-1 cursor-pointer accent-[#E8813A]"
            />
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3 border-t pt-3">
        <button type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Activer le son" : "Couper le son"} className="text-nuit/70 hover:text-vert-fonce">
          {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(event) => {
            setVolume(Number(event.target.value))
            setMuted(false)
          }}
          aria-label="Volume"
          className="h-1 w-24 cursor-pointer accent-[#0D6B4A]"
        />
        <button
          type="button"
          onClick={() => setSpeedIndex((index) => (index + 1) % SPEEDS.length)}
          aria-label={`Vitesse de lecture : x${SPEEDS[speedIndex]}`}
          className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold text-vert-fonce hover:bg-vert-pale"
        >
          <Gauge className="size-3.5" /> x{SPEEDS[speedIndex]}
        </button>
      </div>
    </figure>
  )
}
