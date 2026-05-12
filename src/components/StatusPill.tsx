import { motion, useReducedMotion } from "framer-motion";

interface Props {
  label: string;
  pulse?: boolean;
}

export function StatusPill({ label, pulse = false }: Props) {
  const reduce = useReducedMotion();
  return (
    <div className="inline-flex h-8 items-center gap-2 rounded-full border border-white/[0.04] bg-[rgba(10,10,10,0.55)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl">
      <span className="relative inline-block h-1.5 w-1.5">
        <span className="absolute inset-0 rounded-full bg-vb-emerald shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
        {pulse && !reduce && (
          <motion.span
            className="absolute -inset-1 rounded-full bg-vb-emerald/40"
            animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </span>
      <span className="text-[13px] font-medium tracking-tight text-vb-silver">
        {label}
      </span>
    </div>
  );
}
