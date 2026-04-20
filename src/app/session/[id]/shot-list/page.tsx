// Stage 10 Shot List Mobile Page Purpose
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { StudioOsAuthProvider, useStudioOsAuth } from "@/components/studio-os-auth-provider";

type ShotListItem = {
  readonly id: string;
  readonly description: string;
  readonly mustHave: boolean;
  readonly captured: boolean;
  readonly notes?: string | null;
};

const makeId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);

function ShotListScreen() {
  const { id } = useParams<{ id: string }>();
  const { status, authorizedFetch } = useStudioOsAuth();
  const [sessionTitle, setSessionTitle] = useState("Loading session...");
  const [items, setItems] = useState<ShotListItem[]>([]);
  const [notes, setNotes] = useState("");
  const [draftItem, setDraftItem] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !id) {
      return;
    }

    authorizedFetch(`/sessions/${id}/shot-list`)
      .then((response) => response.json())
      .then((payload) => {
        setSessionTitle(payload.session?.title ?? "Shot list");
        setItems(Array.isArray(payload.shotList?.items) ? payload.shotList.items : []);
        setNotes(payload.shotList?.notes ?? "");
      })
      .catch(() => setMessage("Unable to load shot list."));
  }, [authorizedFetch, id, status]);

  const addItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftItem.trim()) {
      return;
    }

    setItems((current) => [
      ...current,
      { id: makeId(), description: draftItem.trim(), mustHave: false, captured: false, notes: null },
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

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#1d1d1d_0%,_#2f2a23_100%)] px-4 py-6 text-stone-50">
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="rounded-[2rem] border border-white/12 bg-white/10 p-5 backdrop-blur">
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-stone-300">Mobile shot list</p>
          <h1 className="mt-2 font-serif text-4xl">{sessionTitle}</h1>
          <p className="mt-3 text-sm text-stone-300">{items.filter((item) => item.captured).length}/{items.length} captured</p>
        </section>

        <form className="rounded-[2rem] border border-white/12 bg-white/10 p-4 backdrop-blur" onSubmit={addItem}>
          <input
            className="w-full rounded-2xl bg-white px-4 py-4 text-stone-950"
            value={draftItem}
            onChange={(event) => setDraftItem(event.target.value)}
            placeholder="Add shot-list item"
          />
          <button className="mt-3 w-full rounded-2xl bg-amber-300 px-4 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-stone-950">
            Add item
          </button>
        </form>

        <section className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-[2rem] border border-white/12 bg-white/10 p-4 backdrop-blur">
              <p className="text-base font-semibold">{item.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, captured: !entry.captured } : entry)))}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] ${item.captured ? "bg-emerald-300 text-stone-950" : "bg-white/10 text-white"}`}
                >
                  {item.captured ? "Captured" : "Mark captured"}
                </button>
                <button
                  type="button"
                  onClick={() => setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, mustHave: !entry.mustHave } : entry)))}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] ${item.mustHave ? "bg-amber-300 text-stone-950" : "bg-white/10 text-white"}`}
                >
                  {item.mustHave ? "Must-have" : "Optional"}
                </button>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-[2rem] border border-white/12 bg-white/10 p-4 backdrop-blur">
          <textarea
            className="min-h-28 w-full rounded-2xl bg-white px-4 py-4 text-stone-950"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes"
          />
          <button type="button" onClick={() => void save()} className="mt-3 w-full rounded-2xl bg-stone-50 px-4 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-stone-950">
            Save shot list
          </button>
          {message ? <p className="mt-3 text-sm text-stone-200">{message}</p> : null}
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
