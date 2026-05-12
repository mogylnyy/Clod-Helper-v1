import { useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Terminal as TerminalIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "../components/Button";
import type { InstallMode } from "../lib/types";
import { runInstall } from "../lib/api";
import { cn } from "../lib/cn";

const VERBOSE_PREFIX = "__verbose__:";
// How long between revealing successive log lines (ms). Lower = faster
// typewriter. The Rust side already streams live; this just paces lines that
// arrive in tight bursts so the UI feels alive instead of dumping a wall.
const REVEAL_INTERVAL_MS = 55;

interface Props {
  mode: InstallMode;
  proxyUrl: string;
  onBack: () => void;
  onDone: () => void;
}

type Status = "idle" | "running" | "done" | "error";

export function StepInstall({ mode, proxyUrl, onBack, onDone }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  // pending = raw events from backend, revealed = paced output for the UI
  const pendingRef = useRef<string[]>([]);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [verbose, setVerbose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const visibleLog = useMemo(() => {
    if (verbose) {
      return revealed.map((line) =>
        line.startsWith(VERBOSE_PREFIX) ? line.slice(VERBOSE_PREFIX.length) : line,
      );
    }
    return revealed.filter((line) => !line.startsWith(VERBOSE_PREFIX));
  }, [revealed, verbose]);

  // Subscribe to backend log events — push into the pending queue.
  useEffect(() => {
    let unlistenLog: UnlistenFn | null = null;
    let cancelled = false;
    (async () => {
      const u = await listen<string>("install:log", (e) => {
        pendingRef.current.push(e.payload);
      });
      if (cancelled) {
        u();
      } else {
        unlistenLog = u;
      }
    })();
    return () => {
      cancelled = true;
      unlistenLog?.();
    };
  }, []);

  // Reveal one line at a time from pending → revealed. If the pending queue
  // backs up (script dumped 40 lines at once), we still pace at the same
  // interval so the user gets a feel of progress.
  useEffect(() => {
    if (status !== "running" && status !== "done" && status !== "error") return;
    const t = window.setInterval(() => {
      if (pendingRef.current.length === 0) return;
      const next = pendingRef.current.shift()!;
      setRevealed((prev) => [...prev, next]);
    }, REVEAL_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [visibleLog]);

  async function handleStart() {
    setStatus("running");
    setError(null);
    setRevealed([]);
    pendingRef.current = [];
    try {
      await runInstall({ mode, proxyUrl });
      // Don't flip to "done" until the typewriter has caught up — otherwise
      // the success banner appears while the log is still scrolling.
      await drainPending(pendingRef);
      setStatus("done");
    } catch (e: any) {
      await drainPending(pendingRef);
      setError(typeof e === "string" ? e : (e?.message ?? "Неизвестная ошибка"));
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-2xl pt-4">
      <h2 className="text-[22px] font-semibold tracking-tight text-vb-silver">
        {status === "idle" && "Готовы поставить?"}
        {status === "running" && "Устанавливаем Claude…"}
        {status === "done" && "Готово"}
        {status === "error" && "Что-то пошло не так"}
      </h2>
      <p className="mt-1.5 text-[13px] text-vb-silver-dim">
        {status === "idle" &&
          "Это займёт 1-3 минуты. Не закрывайте окно — мы покажем прогресс."}
        {status === "running" &&
          "Может возникнуть запрос от Windows — разрешите."}
        {status === "done" &&
          "Claude настроен и готов к работе. Если прокси перестанет работать — переустановите и введите новый."}
      </p>

      {status === "idle" && (
        <div className="mt-6 flex justify-center">
          <Button onClick={handleStart} className="px-8">
            Установить
          </Button>
        </div>
      )}

      {(status === "running" || status === "done" || status === "error") && (
        <div className="mt-6 glass-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-vb-border/60 px-4 py-2.5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-vb-silver-dim">
              <TerminalIcon className="h-3.5 w-3.5" />
              Журнал установки
              {status === "running" && (
                <Loader2 className="ml-1 h-3 w-3 animate-spin text-vb-silver-dim" />
              )}
            </div>
            <button
              type="button"
              onClick={() => setVerbose((v) => !v)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors",
                verbose
                  ? "bg-vb-surface/60 text-vb-silver"
                  : "text-vb-silver-dim hover:text-vb-silver",
              )}
            >
              {verbose ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Подробно
            </button>
          </div>
          <div
            ref={logRef}
            className="max-h-[420px] min-h-[180px] overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-vb-silver"
          >
            {visibleLog.length === 0 && status === "running" && (
              <div className="flex items-center gap-2 text-vb-silver-dim">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Запускаем…
              </div>
            )}
            <AnimatePresence initial={false}>
              {visibleLog.map((line, i) => (
                <motion.div
                  key={`${i}:${line}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className={cn(
                    "whitespace-pre-wrap",
                    line.startsWith("[stderr]") && "text-vb-loss",
                    (line.startsWith("[exec]") ||
                      line.startsWith("[exit]") ||
                      line.startsWith("⓵") ||
                      line.startsWith("⓶") ||
                      line.startsWith("⓷") ||
                      line.startsWith("⓸") ||
                      line.startsWith("──") ||
                      line.startsWith("D1:") ||
                      line.startsWith("D2:") ||
                      line.startsWith("D3:") ||
                      line.startsWith("D4:") ||
                      line.startsWith("D5:") ||
                      line.startsWith("D6:") ||
                      line.startsWith("[diag")) &&
                      "text-vb-silver-dim/70",
                  )}
                >
                  {line}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-vb-loss/30 bg-vb-loss/5 px-4 py-3 text-[13px] text-vb-loss">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Установка не завершилась</div>
            <div className="mt-1 font-mono text-[12px] opacity-90">{error}</div>
          </div>
        </div>
      )}

      {status === "done" && (mode === "code" || mode === "both") && (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-vb-emerald/30 bg-vb-emerald/5 px-4 py-3 text-[13px] text-vb-silver">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-vb-emerald" />
          <div>
            Откройте новый терминал и введите{" "}
            <code className="rounded bg-vb-bg px-1.5 py-0.5 font-mono text-vb-emerald">
              claude
            </code>
            . Должна появиться приветственная строка.
          </div>
        </div>
      )}

      {status === "done" && mode === "desktop" && (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-vb-emerald/30 bg-vb-emerald/5 px-4 py-3 text-[13px] text-vb-silver">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-vb-emerald" />
          <div>
            Bridge запущен на{" "}
            <code className="rounded bg-vb-bg px-1.5 py-0.5 font-mono text-vb-emerald">
              127.0.0.1:8889
            </code>
            . Запускайте Claude Desktop через ярлык «Claude Desktop (proxy)» с
            рабочего стола.
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={status === "running"}>
          Назад
        </Button>
        {status === "done" && <Button onClick={onDone}>Закрыть</Button>}
        {status === "error" && (
          <Button variant="secondary" onClick={handleStart}>
            Повторить
          </Button>
        )}
      </div>
    </div>
  );
}

async function drainPending(ref: React.MutableRefObject<string[]>) {
  // Wait until the typewriter interval has emptied the queue, with a safety
  // cap so we never block forever.
  const start = Date.now();
  while (ref.current.length > 0 && Date.now() - start < 8000) {
    await new Promise((r) => setTimeout(r, REVEAL_INTERVAL_MS));
  }
}
