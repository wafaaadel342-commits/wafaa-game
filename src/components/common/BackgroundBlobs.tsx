export function BackgroundBlobs({ theme = "default" }: { theme?: "default" | "quiz" | "words" }) {
  const getGradients = () => {
    switch (theme) {
      case "quiz":
        return {
          blob1: "bg-emerald-500/15 dark:bg-emerald-500/20",
          blob2: "bg-teal-500/15 dark:bg-teal-600/20",
          blob3: "bg-cyan-500/10 dark:bg-cyan-700/15",
        };
      case "words":
        return {
          blob1: "bg-violet-500/15 dark:bg-violet-600/25",
          blob2: "bg-amber-500/15 dark:bg-amber-500/20",
          blob3: "bg-fuchsia-500/10 dark:bg-fuchsia-700/15",
        };
      default:
        return {
          blob1: "bg-primary/15 dark:bg-primary/25",
          blob2: "bg-violet-500/15 dark:bg-violet-600/20",
          blob3: "bg-emerald-500/10 dark:bg-emerald-600/15",
        };
    }
  };

  const colors = getGradients();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
    >
      {/* Top right blob */}
      <div
        className={`animate-blob-1 absolute -top-32 -right-32 h-[450px] w-[450px] rounded-full blur-[110px] ${colors.blob1}`}
      />
      {/* Bottom left blob */}
      <div
        className={`animate-blob-2 absolute -bottom-36 -left-32 h-[500px] w-[500px] rounded-full blur-[120px] ${colors.blob2}`}
      />
      {/* Center ambient blob */}
      <div
        className={`absolute top-1/2 left-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px] opacity-60 ${colors.blob3}`}
      />
    </div>
  );
}
