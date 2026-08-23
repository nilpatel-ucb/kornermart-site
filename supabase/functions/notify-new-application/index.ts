import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const NOTIFY_TO = "kornermart@gmail.com";
const DEFAULT_FROM = "KornerMart Hiring <careers@kornermart.com>";

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return `<tr><td style="padding:6px 12px 6px 0;color:#4A6580;vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="padding:6px 0;color:#0B2540">${esc(text)}</td></tr>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "RESEND_API_KEY is not set" }, { status: 500 });
  }

  let payload: { id?: string; record?: { id?: string } };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = payload.record?.id ?? payload.id;
  if (!id) {
    return Response.json({ error: "Missing application id" }, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: app, error } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !app) {
    return Response.json({ error: "Application not found" }, { status: 404 });
  }

  const positions = Array.isArray(app.positions) && app.positions.length
    ? app.positions.join(", ")
    : "an open role";
  const name = (app.full_name || `${app.first_name ?? ""} ${app.last_name ?? ""}`.trim() || "Applicant");
  const subject = `${name} — ${positions}`;
  const location = [app.location_name, app.location_address].filter(Boolean).join(" — ") || "Not specified";
  const submitted = app.created_at
    ? new Date(app.created_at).toLocaleString("en-US", { timeZone: "America/Denver" })
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;max-width:560px">
      <p style="margin:0 0 12px;color:#0B2540">A new KornerMart job application was submitted.</p>
      <table style="border-collapse:collapse;font-size:14px">${
        row("Name", name) +
        row("Position", positions) +
        row("Availability", Array.isArray(app.availability) && app.availability.length ? app.availability.join(", ") : "") +
        row("Preferred location", location) +
        row("Phone", app.phone) +
        row("Email", app.email) +
        row("Resume", app.resume_filename || "None uploaded") +
        row("Submitted", submitted ? submitted + " MT" : "")
      }</table>
      <p style="margin:16px 0 0;color:#4A6580;font-size:13px">Full application is in the KornerMart Supabase table.</p>
    </div>
  `;

  const from = Deno.env.get("RESEND_FROM") || DEFAULT_FROM;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [NOTIFY_TO],
      subject,
      html,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return Response.json({ error: data }, { status: 502 });
  }

  return Response.json({ ok: true, id: data.id });
});
