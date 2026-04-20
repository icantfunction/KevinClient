// Stage 11.5 Shot List Mobile Page Purpose
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  StudioOsAuthProvider,
  useStudioOsAuth,
} from "@/components/studio-os-auth-provider";

type ShotListItem = {
  readonly id: string;
  readonly description: string;
  readonly mustHave: boolean;
  readonly captured: boolean;
  readonly notes?: string | null;
};

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}`;

function ShotListScreen() {
  const { id } = useParams<{ id: string }>();
  const { status, authorizedFetch } = useStudioOsAuth();
  const [sessionTitle, setSessionTitle] = useState("Loading session…");
  const [sessionMeta, setSessionMeta] = useState<string>("");
  const [items, setItems] = useState<ShotListItem[]>([]);
  const [notes, setNotes] = useState("");
  const [draftItem, setDraftItem] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !id) return;
    authorizedFetch(`/sessions/${id}/shot-list`)
      .then((response) => response.json())
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
      .catch(() => setMessage("Unable to load shot list."));
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

  const save = async () => {
    const response = await authorizedFetch(`/sessions/${id}/shot-list`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items, notes }),
    });
    setMessage(response.ok ? "Shot list saved." : "Unable to save shot list.");
  };

  const totalItems = items.length;
  const capturedCount = items.filter((item) => item.captured).length;
  const mustHaveCount = items.filter((item) => item.mustHave).length;
  const progressPct = totalItems
    ? Math.round((capturedCount / totalItems) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-slate-950 pb-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-400 transition hover:text-white"
          >
            ← Dashboard
          </Link>
          <button
            type="button"
            onClick={() => void save()}
            className="rounded-xl bg-amber-300 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-900 transition hover:brightness-110"
          >
            Save shot list
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

        <section className="space-y-2.5">
          {items.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-slate-400">
              No shots yet. Add the must-haves first, then build out the rest.
            </div>
          ) : (
            items.map((item) => (
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
                  {item.mustHave ? (
                    <span className="rounded-full bg-amber-300/20 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-amber-200 ring-1 ring-inset ring-amber-300/30">
                      Must
                    </span>
                  ) : null}
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
