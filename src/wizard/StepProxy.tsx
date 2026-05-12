import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "../components/Button";
import type { ProxyCheckResult, ProxyConfig } from "../lib/types";
import { checkProxy, parseProxy } from "../lib/api";

interface Props {
  proxy: ProxyConfig | null;
  check: ProxyCheckResult | null;
  onChange: (p: ProxyConfig, c: ProxyCheckResult) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepProxy({ proxy, check, onChange, onBack, onNext }: Props) {
  const [url, setUrl] = useState(proxy?.url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProxyCheckResult | null>(check);
  const [parsed, setParsed] = useState<ProxyConfig | null>(proxy);

  async function handleCheck() {
    setBusy(true);
    setError(null);
    try {
      const p = await parseProxy(url.trim());
      const c = await checkProxy(url.trim());
      setParsed(p);
      setResult(c);
      if (c.reachable) {
        onChange(p, c);
      }
    } catch (e: any) {
      setError(typeof e === "string" ? e : (e?.message ?? "Неверный формат"));
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  const reachable = result?.reachable === true;

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
            setUrl(e.target.value);
            setResult(null);
            setError(null);
          }}
          placeholder="http://имя:пароль@адрес:порт"
          className="mt-2 w-full rounded-lg border border-vb-border bg-vb-bg/60 px-4 py-3 font-mono text-[13px] text-vb-silver outline-none transition-colors focus:border-vb-emerald/60"
        />

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            onClick={handleCheck}
            disabled={busy || url.trim().length < 10}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Проверяю…
              </>
            ) : (
              "Проверить соединение"
            )}
          </Button>

          {result && (
            <div className="flex items-center gap-2 text-[13px]">
              {reachable ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-vb-emerald" />
                  <span className="text-vb-silver">
                    Работает{" "}
                    {result.latency_ms != null && (
                      <span className="font-mono text-vb-silver-dim">
                        ({result.latency_ms} ms)
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-vb-loss" />
                  <span className="text-vb-loss">
                    {result.error ?? "Не удалось дозвониться"}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-vb-loss/30 bg-vb-loss/5 px-3 py-2 text-[12px] text-vb-loss">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {parsed && reachable && (
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-vb-border/60 bg-vb-bg/40 p-3 font-mono text-[12px]">
            <Field k="host" v={parsed.host} />
            <Field k="port" v={String(parsed.port)} />
            <Field k="user" v={parsed.username} />
            <Field k="pass" v={"•".repeat(Math.min(parsed.password.length, 10))} />
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Назад
        </Button>
        <Button onClick={onNext} disabled={!reachable}>
          Дальше
        </Button>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-vb-silver-dim">{k}</span>
      <span className="truncate text-vb-silver">{v}</span>
    </div>
  );
}
