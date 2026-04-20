// Stage 10 Search Service Purpose
import { sql } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";

export type GlobalSearchResult = {
  readonly entityType:
    | "client"
    | "inquiry"
    | "session"
    | "smart_file"
    | "gallery"
    | "studio_booking"
    | "invoice"
    | "task"
    | "activity";
  readonly entityId: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly status: string | null;
  readonly occurredAt: Date | null;
  readonly score: number;
};

export class SearchService {
  public constructor(private readonly database: StudioOsDatabase) {}

  public async searchAll(input: { readonly query: string; readonly limit?: number }) {
    const searchQuery = input.query.trim().toLowerCase();
    if (searchQuery.length < 2) {
      return [] as GlobalSearchResult[];
    }

    const likePattern = `%${searchQuery}%`;
    const prefixPattern = `${searchQuery}%`;
    const limit = Math.min(input.limit ?? 25, 100);

    const result = await this.database.execute(sql`
      with ranked as (
        select
          'client'::text as entity_type,
          client.id::text as entity_id,
          client.primary_name::text as title,
          nullif(concat_ws(' | ', client.business_name, client.email, client.phone), '')::text as subtitle,
          null::text as status,
          client.created_at as occurred_at,
          case
            when lower(concat_ws(' ', client.primary_name, client.partner_name, client.business_name, client.email, client.phone)) like ${prefixPattern} then 300
            when lower(concat_ws(' ', client.primary_name, client.partner_name, client.business_name, client.email, client.phone)) like ${likePattern} then 200
            else 0
          end as score
        from clients client
        where client.deleted_at is null
          and lower(concat_ws(' ', client.primary_name, client.partner_name, client.business_name, client.email, client.phone)) like ${likePattern}

        union all

        select
          'inquiry'::text as entity_type,
          inquiry.id::text as entity_id,
          concat('Inquiry: ', inquiry.inquirer_name)::text as title,
          nullif(concat_ws(' | ', inquiry.event_type, inquiry.event_location, inquiry.email, inquiry.phone), '')::text as subtitle,
          inquiry.status::text as status,
          inquiry.created_at as occurred_at,
          case
            when lower(concat_ws(' ', inquiry.inquirer_name, inquiry.email, inquiry.phone, inquiry.event_type, inquiry.event_location, inquiry.message, inquiry.notes)) like ${prefixPattern} then 300
            when lower(concat_ws(' ', inquiry.inquirer_name, inquiry.email, inquiry.phone, inquiry.event_type, inquiry.event_location, inquiry.message, inquiry.notes)) like ${likePattern} then 200
            else 0
          end as score
        from inquiries inquiry
        where inquiry.deleted_at is null
          and lower(concat_ws(' ', inquiry.inquirer_name, inquiry.email, inquiry.phone, inquiry.event_type, inquiry.event_location, inquiry.message, inquiry.notes)) like ${likePattern}

        union all

        select
          'session'::text as entity_type,
          session.id::text as entity_id,
          session.title::text as title,
          nullif(concat_ws(' | ', client.primary_name, session.location_name, session.session_type), '')::text as subtitle,
          session.status::text as status,
          coalesce(session.scheduled_start, session.created_at) as occurred_at,
          case
            when lower(concat_ws(' ', session.title, session.location_name, session.location_address, session.notes, client.primary_name)) like ${prefixPattern} then 300
            when lower(concat_ws(' ', session.title, session.location_name, session.location_address, session.notes, client.primary_name)) like ${likePattern} then 200
            else 0
          end as score
        from sessions session
        left join clients client on client.id = session.client_id
        where session.deleted_at is null
          and lower(concat_ws(' ', session.title, session.location_name, session.location_address, session.notes, client.primary_name)) like ${likePattern}

        union all

        select
          'smart_file'::text as entity_type,
          smart_file.id::text as entity_id,
          smart_file.title::text as title,
          nullif(concat_ws(' | ', client.primary_name, smart_file.subject, smart_file.recipient_email), '')::text as subtitle,
          smart_file.status::text as status,
          coalesce(smart_file.sent_at, smart_file.created_at) as occurred_at,
          case
            when lower(concat_ws(' ', smart_file.title, smart_file.subject, smart_file.message, smart_file.recipient_email, client.primary_name)) like ${prefixPattern} then 300
            when lower(concat_ws(' ', smart_file.title, smart_file.subject, smart_file.message, smart_file.recipient_email, client.primary_name)) like ${likePattern} then 200
            else 0
          end as score
        from smart_files smart_file
        left join clients client on client.id = smart_file.client_id
        where smart_file.deleted_at is null
          and lower(concat_ws(' ', smart_file.title, smart_file.subject, smart_file.message, smart_file.recipient_email, client.primary_name)) like ${likePattern}

        union all

        select
          'gallery'::text as entity_type,
          gallery.id::text as entity_id,
          gallery.title::text as title,
          nullif(concat_ws(' | ', gallery.slug, session.title, client.primary_name), '')::text as subtitle,
          gallery.status::text as status,
          coalesce(gallery.delivered_at, gallery.created_at) as occurred_at,
          case
            when lower(concat_ws(' ', gallery.title, gallery.slug, gallery.description, session.title, client.primary_name)) like ${prefixPattern} then 300
            when lower(concat_ws(' ', gallery.title, gallery.slug, gallery.description, session.title, client.primary_name)) like ${likePattern} then 200
            else 0
          end as score
        from galleries gallery
        left join sessions session on session.id = gallery.session_id
        left join clients client on client.id = session.client_id
        where gallery.deleted_at is null
          and lower(concat_ws(' ', gallery.title, gallery.slug, gallery.description, session.title, client.primary_name)) like ${likePattern}

        union all

        select
          'studio_booking'::text as entity_type,
          booking.id::text as entity_id,
          space.name::text as title,
          nullif(concat_ws(' | ', client.primary_name, booking.purpose, booking.booking_start::text), '')::text as subtitle,
          booking.status::text as status,
          booking.booking_start as occurred_at,
          case
            when lower(concat_ws(' ', space.name, client.primary_name, booking.purpose, booking.notes)) like ${prefixPattern} then 300
            when lower(concat_ws(' ', space.name, client.primary_name, booking.purpose, booking.notes)) like ${likePattern} then 200
            else 0
          end as score
        from studio_bookings booking
        join studio_spaces space on space.id = booking.space_id
        left join clients client on client.id = booking.client_id
        where booking.deleted_at is null
          and lower(concat_ws(' ', space.name, client.primary_name, booking.purpose, booking.notes)) like ${likePattern}

        union all

        select
          'invoice'::text as entity_type,
          invoice.id::text as entity_id,
          concat('Invoice ', left(invoice.id::text, 8))::text as title,
          nullif(concat_ws(' | ', client.primary_name, invoice.source_type, invoice.total_cents::text), '')::text as subtitle,
          invoice.status::text as status,
          coalesce(invoice.due_at, invoice.sent_at, invoice.created_at) as occurred_at,
          case
            when lower(concat_ws(' ', client.primary_name, invoice.source_type, invoice.status, invoice.payment_method_note, invoice.total_cents::text)) like ${prefixPattern} then 300
            when lower(concat_ws(' ', client.primary_name, invoice.source_type, invoice.status, invoice.payment_method_note, invoice.total_cents::text)) like ${likePattern} then 200
            else 0
          end as score
        from invoices invoice
        left join clients client on client.id = invoice.client_id
        where invoice.deleted_at is null
          and lower(concat_ws(' ', client.primary_name, invoice.source_type, invoice.status, invoice.payment_method_note, invoice.total_cents::text)) like ${likePattern}

        union all

        select
          'task'::text as entity_type,
          task.id::text as entity_id,
          task.title::text as title,
          nullif(concat_ws(' | ', task.scope, task.description, task.notes), '')::text as subtitle,
          task.status::text as status,
          coalesce(task.due_at, task.created_at) as occurred_at,
          case
            when lower(concat_ws(' ', task.title, task.description, task.blocked_reason, task.notes)) like ${prefixPattern} then 300
            when lower(concat_ws(' ', task.title, task.description, task.blocked_reason, task.notes)) like ${likePattern} then 200
            else 0
          end as score
        from tasks task
        where task.deleted_at is null
          and lower(concat_ws(' ', task.title, task.description, task.blocked_reason, task.notes)) like ${likePattern}

        union all

        select
          'activity'::text as entity_type,
          activity.id::text as entity_id,
          coalesce(activity.subject, activity.activity_type)::text as title,
          nullif(concat_ws(' | ', activity.scope_type, activity.body), '')::text as subtitle,
          activity.activity_type::text as status,
          activity.occurred_at as occurred_at,
          case
            when lower(concat_ws(' ', activity.subject, activity.body, activity.activity_type, activity.scope_type)) like ${prefixPattern} then 300
            when lower(concat_ws(' ', activity.subject, activity.body, activity.activity_type, activity.scope_type)) like ${likePattern} then 200
            else 0
          end as score
        from activities activity
        where activity.deleted_at is null
          and lower(concat_ws(' ', activity.subject, activity.body, activity.activity_type, activity.scope_type)) like ${likePattern}
      )
      select entity_type, entity_id, title, subtitle, status, occurred_at, score
      from ranked
      where score > 0
      order by score desc, occurred_at desc nulls last
      limit ${sql.raw(String(limit))}
    `);

    return (result.rows as Array<{
      readonly entity_type: GlobalSearchResult["entityType"];
      readonly entity_id: string;
      readonly title: string;
      readonly subtitle: string | null;
      readonly status: string | null;
      readonly occurred_at: string | Date | null;
      readonly score: string | number;
    }>).map((row) => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
      subtitle: row.subtitle,
      status: row.status,
      occurredAt: row.occurred_at ? new Date(row.occurred_at) : null,
      score: typeof row.score === "number" ? row.score : Number(row.score),
    }));
  }
}
