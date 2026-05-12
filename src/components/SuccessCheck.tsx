import { motion, useReducedMotion } from "framer-motion";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_CHECK: [number, number, number, number] = [0.34, 1.2, 0.64, 1];

export function SuccessCheck() {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div className="relative mx-auto h-[72px] w-[72px]">
        <div className="absolute inset-[-24px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.18)_0%,transparent_65%)] blur-xl" />
        <div className="absolute inset-0 rounded-full border border-[rgba(16,185,129,0.35)] bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.15)_0%,rgba(10,10,10,0.4)_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_40px_rgba(16,185,129,0.25)]" />
        <svg
          viewBox="0 0 72 72"
          className="absolute inset-0 h-full w-full"
          fill="none"
        >
          <path
            d="M22 38 L32 48 L52 26"
            stroke="#D4D4D8"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.85 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      className="relative mx-auto h-[72px] w-[72px]"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.05 }}
        className="absolute inset-[-24px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.18)_0%,transparent_65%)] blur-xl"
      />
      <div className="absolute inset-0 rounded-full border border-[rgba(16,185,129,0.35)] bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.15)_0%,rgba(10,10,10,0.4)_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_40px_rgba(16,185,129,0.25)]" />
      <svg
        viewBox="0 0 72 72"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        <motion.path
          d="M22 38 L32 48 L52 26"
          stroke="#D4D4D8"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            pathLength: { duration: 0.42, delay: 0.18, ease: EASE_CHECK },
            opacity: { duration: 0.1, delay: 0.18 },
          }}
        />
      </svg>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.9, delay: 0.7, ease: EASE_OUT }}
        className="pointer-events-none absolute -inset-2 rounded-full shadow-[0_0_48px_rgba(16,185,129,0.45)]"
      />
    </motion.div>
  );
}
