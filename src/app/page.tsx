"use client";

import { useRef, useState } from "react";
import { Flame } from "lucide-react";

export default function Page() {
  const [username, setUsername] = useState("");
  const [roast, setRoast] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const handleRoast = async () => {
    if (!username.trim() || loading) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setRoast("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setRoast((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col min-h-[100dvh] space-y-12 pt-8 pb-16">
      <section>
        <p className="text-sm font-medium tracking-wide uppercase mb-4" style={{ color: "var(--color-muted-foreground)" }}>
          Tool
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl leading-tight mb-4">
          Roast My GitHub
        </h1>
        <p className="text-lg leading-relaxed max-w-md" style={{ color: "var(--color-muted-foreground)" }}>
          Enter a GitHub username and get a savage, AI-generated roast of their
          profile, repos, and coding habits.
        </p>
      </section>

      <div className="w-12 h-px" style={{ backgroundColor: "var(--color-border)" }} />

      <section className="space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              github.com/
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRoast()}
              placeholder="username"
              autoComplete="off"
              spellCheck={false}
              className="w-full pl-[6.5rem] pr-4 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors"
              style={{
                backgroundColor: "var(--color-secondary)",
                borderColor: "var(--color-border)",
              }}
            />
          </div>
          <button
            onClick={handleRoast}
            disabled={!username.trim() || loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            style={{ backgroundColor: "var(--color-foreground)", color: "var(--color-background)" }}
          >
            <Flame className="size-4" />
            {loading ? "Roasting…" : "Roast"}
          </button>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--color-destructive)" }}>
            {error}
          </p>
        )}
      </section>

      {(roast || loading) && (
        <section>
          <h2 className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: "var(--color-muted-foreground)" }}>
            The Roast
          </h2>
          <div className="text-base leading-relaxed whitespace-pre-wrap">
            {roast}
            {loading && (
              <span
                className="inline-block w-0.5 h-[1.1em] ml-0.5 align-middle animate-pulse"
                style={{ backgroundColor: "var(--color-foreground)", opacity: 0.4 }}
              />
            )}
          </div>
        </section>
      )}

      <footer className="mt-auto pt-8 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        built by{" "}
        <a
          href="https://gauranshsharma.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Gauransh Sharma
        </a>
      </footer>
    </main>
  );
}
