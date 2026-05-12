import { Terminal, MessageSquare } from "lucide-react";
import { Button } from "../components/Button";
import type { InstallMode } from "../lib/types";
import { cn } from "../lib/cn";

interface Props {
  value: InstallMode | null;
  onChange: (v: InstallMode) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepMode({ value, onChange, onBack, onNext }: Props) {
  const items: {
    key: InstallMode;
    icon: React.ReactNode;
    title: string;
    body: string;
  }[] = [
    {
      key: "code",
      icon: <Terminal className="h-5 w-5" strokeWidth={1.5} />,
      title: "Claude в терминале и VS Code",
      body: "Для программистов и автоматизации. Команда `claude` в командной строке.",
    },
    {
      key: "desktop",
      icon: <MessageSquare className="h-5 w-5" strokeWidth={1.5} />,
      title: "Claude Desktop",
      body: "Обычное приложение с чатом — как Telegram, только Claude.",
    },
    {
      key: "both",
      icon: (
        <div className="flex">
          <Terminal className="h-5 w-5" strokeWidth={1.5} />
          <MessageSquare
            className="-ml-1 h-5 w-5"
            strokeWidth={1.5}
          />
        </div>
      ),
      title: "И то, и другое",
      body: "Поставим обе версии. Прокси будет общий.",
    },
  ];
  return (
    <div className="mx-auto max-w-2xl pt-4">
      <h2 className="text-[22px] font-semibold tracking-tight text-vb-silver">
        Что вам нужно?
      </h2>
      <p className="mt-1.5 text-[13px] text-vb-silver-dim">
        Можно выбрать одно из трёх — потом переустановка не нужна, можно
        добавить вторую часть позже.
      </p>

      <div className="mt-7 space-y-3">
        {items.map((it) => {
          const selected = value === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              className={cn(
                "block w-full rounded-2xl border p-5 text-left transition-all",
                selected
                  ? "border-vb-emerald bg-vb-emerald/5 shadow-[0_0_0_1px_rgba(16,185,129,0.4)]"
                  : "border-vb-border bg-vb-surface/40 hover:border-vb-silver-dim",
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    selected
                      ? "bg-vb-emerald/15 text-vb-emerald"
                      : "bg-vb-bg text-vb-silver-dim",
                  )}
                >
                  {it.icon}
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-medium text-vb-silver">
                    {it.title}
                  </div>
                  <div className="mt-1 text-[13px] leading-relaxed text-vb-silver-dim">
                    {it.body}
                  </div>
                </div>
                <div
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 rounded-full border transition-colors",
                    selected
                      ? "border-vb-emerald bg-vb-emerald"
                      : "border-vb-border",
                  )}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Назад
        </Button>
        <Button onClick={onNext} disabled={!value}>
          Дальше
        </Button>
      </div>
    </div>
  );
}
