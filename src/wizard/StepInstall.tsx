import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Terminal as TerminalIcon,
} from "lucide-react";
import { Button } from "../components/Button";
import type { InstallMode } from "../lib/types";
import { runInstall } from "../lib/api";

interface Props {
  mode: InstallMode;
  proxyUrl: string;
  onBack: () => void;
  onDone: () => void;
}

type Status = "idle" | "running" | "done" | "error";

export function StepInstall({ mode, proxyUrl, onBack, onDone }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unlistenLog: UnlistenFn | null = null;
    let cancelled = false;
    (async () => {
      const u = await listen<string>("install:log", (e) => {
        setLog((prev) => [...prev, e.payload]);
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

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  async function handleStart() {
    setStatus("running");
    setError(null);
    setLog([]);
    try {
      await runInstall({ mode, proxyUrl });
      setStatus("done");
    } catch (e: any) {
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
          <div className="flex items-center gap-2 border-b border-vb-border/60 px-4 py-2.5 text-[11px] uppercase tracking-wider text-vb-silver-dim">
            <TerminalIcon className="h-3.5 w-3.5" />
            Журнал установки
          </div>
          <div
            ref={logRef}
            className="max-h-[420px] min-h-[180px] overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-vb-silver"
          >
            {log.length === 0 && status === "running" && (
              <div className="flex items-center gap-2 text-vb-silver-dim">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Запускаем…
              </div>
            )}
            {log.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap">
                {line}
              </div>
            ))}
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
