import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "../components/Button";
import { CountryFlag } from "../components/CountryFlag";
import type { ProxyCheckResult, ProxyConfig } from "../lib/types";
import { checkProxy, parseProxy } from "../lib/api";

interface Props {
  proxy: ProxyConfig | null;
  check: ProxyCheckResult | null;
  onChange: (p: ProxyConfig, c: ProxyCheckResult) => void;
  onBack: () => void;
  onNext: () => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; result: ProxyCheckResult; parsed: ProxyConfig }
  | { kind: "error"; message: string; result?: ProxyCheckResult };

export function StepProxy({ proxy, check, onChange, onBack, onNext }: Props) {
  const [url, setUrl] = useState(proxy?.url ?? "");
  const [status, setStatus] = useState<Status>(() => {
    if (proxy && check?.reachable) return { kind: "ok", result: check, parsed: proxy };
    return { kind: "idle" };
  });
  const timerRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  function scheduleCheck(value: string) {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    const trimmed = value.trim();
    if (trimmed.length < 10) {
      setStatus({ kind: "idle" });
      return;
    }
    setStatus({ kind: "checking" });
    timerRef.current = window.setTimeout(() => {
      void runCheck(trimmed);
    }, 800);
  }

  async function runCheck(value: string) {
    const myId = ++reqIdRef.current;
    try {
      const parsed = await parseProxy(value);
      const result = await checkProxy(value);
      if (myId !== reqIdRef.current) return;
      if (result.reachable) {
        setStatus({ kind: "ok", result, parsed });
        onChange(parsed, result);
      } else {
        setStatus({
          kind: "error",
          message: result.error ?? "Прокси не отвечает",
          result,
        });
      }
    } catch (e: any) {
      if (myId !== reqIdRef.current) return;
      setStatus({
        kind: "error",
        message: typeof e === "string" ? e : (e?.message ?? "Неверный формат URL"),
      });
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const canNext = status.kind === "ok";

  return (
    <div className="mx-auto max-w-2xl pt-4">
      <h2 className="text-[22px] font-semibold tracking-tight text-vb-silver">
        Вставьте прокси
      </h2>
      <p className="mt-1.5 text-[13px] text-vb-silver-dim">
        Скопируйте строку целиком из письма продавца. Мы сами разберём её на
        части.
      </p>

      <div className="mt-7 glass-card p-6">
        <label className="block text-[11px] uppercase tracking-wider text-vb-silver-dim">
          URL прокси
        </label>
        <input
          type="text"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          value={url}
          onChange={(e) => {
            const v = e.target.value;
            setUrl(v);
            scheduleCheck(v);
          }}
          placeholder="http://имя:пароль@адрес:порт"
          className="mt-2 w-full rounded-lg border border-vb-border bg-vb-bg/60 px-4 py-3 font-mono text-[13px] text-vb-silver outline-none transition-colors focus:border-vb-emerald/60"
        />

        <div className="mt-3 min-h-[22px] px-1">
          <AnimatePresence mode="wait">
            {status.kind === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="text-[11px] text-vb-silver-dim/70"
              >
                Введите URL — мы автоматически проверим
              </motion.div>
            )}

            {status.kind === "checking" && (
              <motion.div
                key="checking"
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-2"
              >
                <Loader2
                  size={12}
                  className="animate-spin text-vb-silver-dim"
                />
                <span className="text-[11px] font-mono text-vb-silver-dim">
                  Проверка прокси…
                </span>
              </motion.div>
            )}

            {status.kind === "ok" && (
              <motion.div
                key="ok"
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.22 }}
                className="flex min-w-0 items-center gap-2"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 600, damping: 20 }}
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-vb-emerald shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                />
                {status.result.country_code && (
                  <CountryFlag code={status.result.country_code} />
                )}
                <span className="min-w-0 truncate font-mono text-[11px] text-vb-emerald/90">
                  {[
                    status.result.ip,
                    status.result.isp,
                    status.result.latency_ms != null
                      ? `${status.result.latency_ms}ms`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </span>
              </motion.div>
            )}

            {status.kind === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.18 }}
                className="flex items-start gap-2"
              >
                <XCircle size={12} className="mt-0.5 shrink-0 text-vb-loss" />
                <span className="text-[11px] text-vb-loss">
                  {status.message}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {status.kind === "ok" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.25 }}
            className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border border-vb-border/60 bg-vb-bg/40 p-3 font-mono text-[12px]"
          >
            <Field k="host" v={status.parsed.host} />
            <Field k="port" v={String(status.parsed.port)} />
            <Field k="user" v={status.parsed.username} />
            <Field
              k="pass"
              v={"•".repeat(Math.min(status.parsed.password.length, 10))}
            />
            {status.result.country_name && (
              <Field
                k="страна"
                v={status.result.country_name}
                accent
              />
            )}
            {status.result.isp && (
              <Field k="провайдер" v={status.result.isp} accent />
            )}
          </motion.div>
        )}

        {url.includes("@") &&
          /(\d+\.\d+\.\d+\.\d+)/.test(url) &&
          status.kind === "ok" &&
          status.result.country_code === "ru" && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-vb-warn/30 bg-vb-warn/5 px-3 py-2 text-[12px] text-vb-warn">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Этот прокси в России. Claude его не примет — нужен зарубежный.
              </span>
            </div>
          )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Назад
        </Button>
        <Button onClick={onNext} disabled={!canNext}>
          Дальше
        </Button>
      </div>
    </div>
  );
}

function Field({
  k,
  v,
  accent,
}: {
  k: string;
  v: string;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-vb-silver-dim">{k}</span>
      <span
        className={
          accent ? "truncate text-vb-emerald/90" : "truncate text-vb-silver"
        }
      >
        {v}
      </span>
    </div>
  );
}
