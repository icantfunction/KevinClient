// Stage 11.5 Shot List Mobile Page Purpose
"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  StudioOsAuthProvider,
  useStudioOsAuth,
} from "@/components/studio-os-auth-provider";
import {
  StudioOsAuthRequiredScreen,
  StudioOsLoadingScreen,
} from "@/components/studio-os-state-screens";
import { readJsonResponse } from "@/lib/http";

type ShotListItem = {
  readonly id: string;
  readonly description: string;
  readonly mustHave: boolean;
  readonly captured: boolean;
  readonly notes?: string | null;
};

type ShotListPayload = {
  readonly session?: {
    readonly title?: string;
    readonly sessionType?: string;
    readonly locationName?: string;
  };
  readonly shotList?: {
    readonly items?: ShotListItem[];
    readonly notes?: string | null;
  };
};

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}`;

type ShotFilter = "all" | "must" | "remaining" | "captured";

function ShotListScreen() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { status, authorizedFetch } = useStudioOsAuth();
  const [sessionTitle, setSessionTitle] = useState("Loading session…");
  const [sessionMeta, setSessionMeta] = useState<string>("");
  const [items, setItems] = useState<ShotListItem[]>([]);
  const [notes, setNotes] = useState("");
  const [draftItem, setDraftItem] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filter, setFilter] = useState<ShotFilter>("all");

  useEffect(() => {
    if (status !== "authenticated" || !id) return;
    setMessage(null);
    authorizedFetch(`/sessions/${id}/shot-list`)
      .then((response) =>
        readJsonResponse<ShotListPayload>(
          response,
          "Unable to load the shot list.",
        ),
      )
      .then((payload) => {
        setSessionTitle(payload.session?.title ?? "Shot list");
        const meta = [
          payload.session?.sessionType,
          payload.session?.locationName,
        ]
          .filter(Boolean)
          .join(" · ");
        setSessionMeta(meta);
        setItems(
          Array.isArray(payload.shotList?.items) ? payload.shotList.items : [],
        );
        setNotes(payload.shotList?.notes ?? "");
      })
      .catch((error) =>
        setMessage(
          error instanceof Error ? error.message : "Unable to load shot list.",
        ),
      );
  }, [authorizedFetch, id, status]);

  const addItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftItem.trim()) return;
    setItems((current) => [
      ...current,
      {
        id: makeId(),
        description: draftItem.trim(),
        mustHave: false,
        captured: false,
        notes: null,
      },
    ]);
    setDraftItem("");
  };

  const removeItem = (itemId: string) => {
    setItems((current) => current.filter((entry) => entry.id !== itemId));
  };

  const save = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await readJsonResponse<ShotListPayload>(
        await authorizedFetch(`/sessions/${id}/shot-list`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items, notes }),
        }),
        "Unable to save the shot list.",
      );
      setMessage("Shot list saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save shot list.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const totalItems = items.length;
  const capturedCount = items.filter((item) => item.captured).length;
  const mustHaveCount = items.filter((item) => item.mustHave).length;
  const remainingCount = totalItems - capturedCount;
  const progressPct = totalItems
    ? Math.round((capturedCount / totalItems) * 100)
    : 0;

  const filteredItems = items.filter((item) => {
    if (filter === "must") return item.mustHave;
    if (filter === "remaining") return !item.captured;
    if (filter === "captured") return item.captured;
    return true;
  });

  const filterOptions: ReadonlyArray<{
    readonly value: ShotFilter;
    readonly label: string;
    readonly count: number;
  }> = [
    { value: "all", label: "All", count: totalItems },
    { value: "must", label: "Must-have", count: mustHaveCount },
    { value: "remaining", label: "Remaining", count: remainingCount },
    { value: "captured", label: "Captured", count: capturedCount },
  ];

  if (status === "booting") {
    return (
      <StudioOsLoadingScreen
        title="Loading shot list"
        description="Checking your session access."
      />
    );
  }

  if (status !== "authenticated") {
    return (
      <StudioOsAuthRequiredScreen
        href={`/admin?next=${encodeURIComponent(pathname)}`}
        title="Sign in to open this shot list"
        description="Session shot lists are protected inside Studio OS."
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 pb-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-400 transition hover:text-white"
          >
            ← Dashboard
          </Link>
          <button
            type="button"
            onClick={() => void save()}
            disabled={isSaving}
            className="rounded-xl bg-amber-300 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-900 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save shot list"}
          </button>
        </div>

        <section className="rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Mobile shot list
          </p>
          <h1 className="mt-2 font-serif text-[1.8rem] leading-tight">
            {sessionTitle}
          </h1>
          {sessionMeta ? (
            <p className="mt-1 text-sm text-slate-400">{sessionMeta}</p>
          ) : null}

          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white/5 px-3 py-3">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Captured
              </p>
              <p className="mt-1 font-serif text-2xl">
                {capturedCount}
                <span className="text-slate-500">/{totalItems}</span>
              </p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-3">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Must-have
              </p>
              <p className="mt-1 font-serif text-2xl">{mustHaveCount}</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-3">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Progress
              </p>
              <p className="mt-1 font-serif text-2xl">{progressPct}%</p>
            </div>
          </div>

          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-400 transition-[width]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </section>

        <form
          className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4 backdrop-blur"
          onSubmit={addItem}
        >
          <label className="block">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Add shot
            </span>
            <input
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/95 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-300/30"
              value={draftItem}
              onChange={(event) => setDraftItem(event.target.value)}
              placeholder="e.g. First look, ring detail, bridal portrait"
            />
          </label>
          <button
            type="submit"
            className="mt-3 w-full rounded-xl bg-amber-300 px-4 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-slate-950 transition hover:brightness-110"
          >
            Add to list
          </button>
        </form>

        {totalItems > 0 ? (
          <div
            role="tablist"
            aria-label="Filter shots"
            className="flex flex-wrap gap-1.5"
          >
            {filterOptions.map((option) => {
              const isActive = filter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setFilter(option.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] transition ${
                    isActive
                      ? "bg-amber-300 text-slate-950"
                      : "bg-white/10 text-slate-200 hover:bg-white/15"
                  }`}
                >
                  {option.label}
                  <span
                    className={`rounded-full px-1.5 text-[0.62rem] tracking-normal ${
                      isActive
                        ? "bg-slate-950/15 text-slate-950"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <section className="space-y-2.5">
          {totalItems === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-slate-400">
              No shots yet. Add the must-haves first, then build out the rest.
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-400">
              Nothing matches this filter.
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="ml-2 text-amber-200 underline-offset-4 transition hover:underline"
              >
                Show all
              </button>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border bg-white/5 p-4 backdrop-blur transition ${
                  item.captured
                    ? "border-emerald-400/40 bg-emerald-400/10"
                    : "border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={`flex-1 text-base leading-6 ${
                      item.captured
                        ? "text-slate-300 line-through decoration-emerald-300/50"
                        : "text-slate-50"
                    }`}
                  >
                    {item.description}
                  </p>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {item.mustHave ? (
                      <span className="rounded-full bg-amber-300/20 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-amber-200 ring-1 ring-inset ring-amber-300/30">
                        Must
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label="Delete shot"
                      title="Delete shot"
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M10 11v7M14 11v7" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, captured: !entry.captured }
                            : entry,
                        ),
                      )
                    }
                    className={`rounded-xl px-3 py-2.5 text-[0.74rem] font-semibold uppercase tracking-[0.14em] transition ${
                      item.captured
                        ? "bg-emerald-300 text-slate-950"
                        : "bg-white/10 text-slate-100 hover:bg-white/15"
                    }`}
                  >
                    {item.captured ? "✓ Captured" : "Mark captured"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, mustHave: !entry.mustHave }
                            : entry,
                        ),
                      )
                    }
                    className={`rounded-xl px-3 py-2.5 text-[0.74rem] font-semibold uppercase tracking-[0.14em] transition ${
                      item.mustHave
                        ? "bg-amber-300 text-slate-950"
                        : "bg-white/10 text-slate-100 hover:bg-white/15"
                    }`}
                  >
                    {item.mustHave ? "★ Must-have" : "Mark must-have"}
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4 backdrop-blur">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Notes
          </span>
          <textarea
            className="mt-1.5 min-h-32 w-full resize-none rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-300/30"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Lighting notes, lens plan, client preferences…"
          />
          {message ? (
            <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-200">
              {message}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default function ShotListPage() {
  return (
    <StudioOsAuthProvider>
      <ShotListScreen />
    </StudioOsAuthProvider>
  );
}
