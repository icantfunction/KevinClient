import type { Metadata } from "next";
import { amenities, floorplan } from "@/data/amenities";

export const metadata: Metadata = {
  title: "Amenities",
  description:
    "Explore equipment, backdrops, furniture, and inclusions at Worldwide Studio Space.",
};

export default function AmenitiesPage() {
  return (
    <main className="section">
      <div className="mx-auto max-w-6xl space-y-10">
        <div>
          <p className="section-kicker">Amenities</p>
          <h1 className="section-title">Equipment + included essentials</h1>
          <p className="mt-3 text-sm text-neutral-600">
            The space comes ready for shoots and events with flexible setups.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.4fr,0.6fr]">
          <div className="grid gap-4 md:grid-cols-2">
            {amenities.map((amenity) => (
              <div key={amenity.name} className="card p-5">
                <p className="text-sm font-semibold">{amenity.name}</p>
                <p className="mt-2 text-sm text-neutral-600">
                  {amenity.description}
                </p>
              </div>
            ))}
          </div>
          <div className="card p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
              Floorplan snapshot
            </p>
            <div className="mt-4 space-y-2 text-sm text-neutral-600">
              <p>{floorplan.totalSquareFeet} total</p>
              <p>{floorplan.studioSquareFeet} open studio</p>
              <p>{floorplan.ceilingHeight} ceilings</p>
              <p>{floorplan.capacityStanding} standing</p>
              <p>{floorplan.capacitySeated} seated</p>
            </div>
            <p className="mt-4 text-xs text-neutral-500">
              {floorplan.layoutNotes}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
