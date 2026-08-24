import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const NOTIFY_TO = "kornermart@gmail.com";
const DEFAULT_FROM = "KornerMart Hiring <careers@kornermart.com>";
const APPLICATIONS_URL = "https://kornermart.com/applications.html";
const RESUME_LINK_SECONDS = 7 * 24 * 60 * 60;
const TZ = "America/Denver";

const QUESTIONS = [
  { key: "transportation", label: "Transportation to/from work", notes: null as string | null },
  { key: "over_21", label: "21 years of age or older", notes: null },
  { key: "work_authorization", label: "Can present proof of legal right to work", notes: null },
  { key: "drug_test", label: "Willing to submit to a controlled-substance test", notes: null },
  { key: "essential_functions", label: "Able to perform essential functions", notes: "essential_functions_notes" },
  { key: "convicted", label: "Convicted of a criminal offense (other than minor traffic)", notes: "conviction_notes" },
  { key: "extra_skills", label: "Additional skills that suit this work", notes: "extra_skills_notes" },
  { key: "currently_employed", label: "Currently employed", notes: "employment_details" },
];

type AppRow = Record<string, unknown>;

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dash(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function yn(value: unknown) {
  if (value === "Y") return "Yes";
  if (value === "N") return "No";
  return dash(value);
}

function positionsOf(app: AppRow) {
  return Array.isArray(app.positions) ? app.positions.filter(Boolean) as string[] : [];
}

function displayName(app: AppRow) {
  return String(app.full_name || `${app.first_name ?? ""} ${app.last_name ?? ""}`.trim() || "Applicant");
}

function hoursFor(app: AppRow) {
  const av = Array.isArray(app.availability) ? app.availability.filter(Boolean) : [];
  return av.length ? av.join(", ") : "—";
}

function addressOf(app: AppRow) {
  return [
    app.address_line1,
    app.address_line2,
    [app.city, app.state].filter(Boolean).join(", "),
    app.zip,
  ].filter(Boolean).join(", ") || "—";
}

function fmtDateTime(iso: unknown) {
  if (!iso) return "—";
  return new Date(String(iso)).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });
}

function section(title: string, inner: string) {
  return `
    <tr>
      <td style="padding:18px 20px 8px;font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#1B75BC">${esc(title)}</td>
    </tr>
    <tr>
      <td style="padding:0 20px 16px">${inner}</td>
    </tr>`;
}

function kv(label: string, valueHtml: string) {
  return `<tr>
    <td style="padding:6px 16px 6px 0;color:#4A6580;vertical-align:top;white-space:nowrap;font-size:14px">${esc(label)}</td>
    <td style="padding:6px 0;color:#0B2540;font-size:14px">${valueHtml}</td>
  </tr>`;
}

function fact(label: string, valueHtml: string) {
  return `<td style="padding:0 16px 12px 0;vertical-align:top;width:50%">
    <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4A6580;margin-bottom:3px">${esc(label)}</div>
    <div style="font-size:14px;color:#0B2540;word-break:break-word">${valueHtml}</div>
  </td>`;
}

function qRow(label: string, value: unknown, notes: unknown) {
  const note = String(notes ?? "").trim();
  return `<tr>
      <td style="padding:10px 16px 10px 0;border-bottom:1px solid #E4EDF5;color:#0B2540;font-size:14px;vertical-align:top">${esc(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #E4EDF5;color:#0B2540;font-size:14px;font-weight:700;text-align:right;white-space:nowrap;vertical-align:top">${esc(yn(value))}</td>
    </tr>` + (note
    ? `<tr><td colspan="2" style="padding:8px 12px 10px;color:#4A6580;font-size:13px;background:#F2F8FD">${esc(note)}</td></tr>`
    : "");
}

function mailto(email: unknown) {
  const text = String(email ?? "").trim();
  if (!text) return "—";
  return `<a href="mailto:${esc(text)}" style="color:#1B75BC;font-weight:600;text-decoration:none">${esc(text)}</a>`;
}

function tel(phone: unknown) {
  const text = String(phone ?? "").trim();
  if (!text) return "—";
  return `<a href="tel:${esc(text)}" style="color:#1B75BC;font-weight:600;text-decoration:none">${esc(text)}</a>`;
}

function link(href: string, label: string) {
  return `<a href="${esc(href)}" style="color:#1B75BC;font-weight:700;text-decoration:none">${esc(label)}</a>`;
}

function buildHtml(app: AppRow, resumeUrl: string | null) {
  const name = displayName(app);
  const roles = positionsOf(app);
  const primary = roles[0] || "Open role";
  const store = String(app.preferred_location || app.location_name || "—");
  const submitted = fmtDateTime(app.created_at);
  const fileName = String(app.resume_filename || "resume");
  const resumeInner = resumeUrl
    ? `${link(resumeUrl, fileName)}<div style="color:#4A6580;font-size:12px;margin-top:4px">Opens the file. Link expires in 7 days.</div>`
    : "No resume uploaded.";

  const questions = QUESTIONS.map((q) =>
    qRow(q.label, app[q.key], q.notes ? app[q.notes] : null)
  ).join("");
  const contactQ = (app.currently_employed === "Y" || app.contact_employer)
    ? qRow("May we contact current employer", app.contact_employer, app.contact_employer_details)
    : "";
  const cert = app.terms_accepted
    ? "Applicant certified that the information is true and complete and accepted the Terms &amp; Conditions."
    : "Certification not recorded.";
  const marketing = app.marketing_opt_in ? " Opted in to promotional emails." : "";
  const rolePills = roles.length
    ? roles.map((p) =>
      `<span style="display:inline-block;margin:0 8px 8px 0;padding:4px 10px;border-radius:999px;background:#E8F4FC;color:#1B75BC;font-size:12px;font-weight:700">${esc(p)}</span>`
    ).join("")
    : `<span style="color:#4A6580;font-size:14px">—</span>`;
  const education = String(app.education ?? "").trim() || "—";

  return `
    <div style="background:#F2F8FD;padding:24px 12px;font-family:Arial,sans-serif">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d7e8f6">
        <tr>
          <td style="background:#1B75BC;background:linear-gradient(135deg,#1B75BC,#2FA8E1);padding:22px 20px;color:#ffffff">
            <div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;opacity:.9">New KornerMart application</div>
            <div style="font-size:24px;font-weight:800;margin:8px 0 4px;letter-spacing:-.03em">${esc(name)}</div>
            <div style="font-size:14px;opacity:.92">${esc(primary)}${app.location_name ? " · " + esc(String(app.location_name)) : ""}</div>
            <div style="font-size:13px;opacity:.9;margin-top:6px">Submitted ${esc(submitted)} MT</div>
          </td>
        </tr>
        ${section("Contact", `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>${fact("Phone", tel(app.phone))}${fact("Email", mailto(app.email))}</tr>
          <tr>${fact("Address", esc(addressOf(app)))}${fact("Submitted", esc(submitted) + " MT")}</tr>
        </table>`)}
        ${section("Positions", `
          <div style="margin-bottom:10px">${rolePills}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            ${kv("Preferred store", esc(dash(store)))}
            ${kv("Availability", esc(hoursFor(app)))}
          </table>`)}
        ${section("Resume", resumeInner)}
        ${section("Application questions", `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${questions}${contactQ}</table>`)}
        ${section("Education, training and experience", `<div style="font-size:14px;color:#0B2540;white-space:pre-wrap">${esc(education)}</div>`)}
        <tr>
          <td style="padding:0 20px 8px;font-size:13px;color:#4A6580">${cert}${marketing}</td>
        </tr>
        <tr>
          <td style="padding:16px 20px 24px">
            <a href="${esc(APPLICATIONS_URL)}" style="display:inline-block;background:#1B75BC;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 18px;border-radius:999px">Open hiring inbox</a>
          </td>
        </tr>
      </table>
    </div>`;
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

  let resumeUrl: string | null = null;
  if (app.resume_path) {
    const { data: signed } = await supabase.storage
      .from("resumes")
      .createSignedUrl(String(app.resume_path), RESUME_LINK_SECONDS);
    resumeUrl = signed?.signedUrl ?? null;
  }

  const positions = positionsOf(app);
  const name = displayName(app);
  const subject = `${name} — ${positions.length ? positions.join(", ") : "an open role"}`;
  const html = buildHtml(app as AppRow, resumeUrl);

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
