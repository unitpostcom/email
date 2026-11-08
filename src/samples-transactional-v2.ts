// Transactional samples, second set — the EMAIL_DESIGN.md house style (600px
// card, bands with their own gutters, one accent per template) composed from
// the themed band builders in bands.ts plus the extra bands in sample-kit.ts.
// Every one is a complete, sendable EmailDocument: the gallery previews it,
// "Add to workspace" clones it, and the codec round-trip test keeps it honest.
//
// Copy is sample copy for a fictional brand; {{variables}} mark the values a
// real send supplies. `sampleValues` fills them for previews.

import {
  bands,
  band,
  button,
  copy,
  divider,
  FIRST_NAME,
  h2,
  h3,
  icon,
  inputs,
  link,
  list,
  overline,
  palette,
  personRow,
  productLine,
  progressBar,
  sampleDocument,
  section,
  small,
  spacer,
  starRow,
  stockAvatar,
  stockSquare,
  stockWide,
  text,
  timeline,
  type SampleTemplate,
} from "./sample-kit";

const EX = "https://northwind.example";

// ---------------------------------------------------------------------------
// Order confirmation — e-commerce, terracotta accent, product lines + totals
// ---------------------------------------------------------------------------
const orderConfirmation = (() => {
  const p = palette("terracotta");
  const brand = { name: "Alder & Finch" };
  return {
    key: "order-confirmation",
    name: "Order confirmation",
    category: "transactional" as const,
    subject: "Order {{order_number}} confirmed",
    sampleValues: {
      first_name: "Maya",
      order_number: "#A-10482",
      order_date: "5 Nov 2026",
      delivery_window: "Mon 9 – Wed 11 Nov",
      shipping_address: "14 Harbour Lane, Apt 3, Bristol BS1 4QA",
      order_url: `${EX}/orders/A-10482`,
    },
    design: sampleDocument({
      key: "order",
      category: "transactional",
      previewText: "Thanks, {{first_name}}. Order {{order_number}} is confirmed and arrives {{delivery_window}}.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("order_number", "order_date", "delivery_window", "shipping_address", "order_url")],
      blocks: [
        ...bands.headerWordmark(p, brand, { label: "Order {{order_number}}" }),
        ...bands.heroStatus(p, {
          icon: "shopping-bag",
          overline: "Order confirmed",
          title: "Thanks for your order, {{first_name}}",
          line: "We're getting it ready now. You'll get another email with tracking the moment it ships.",
        }),
        divider(p.border),
        spacer(18),
        band([h2("What you ordered", p.ink, { marginBottom: 0 })], { paddingY: 0 }),
        spacer(6),
        productLine(p, { image: stockSquare("sneakerTan"), name: "Court sneaker", meta: "Tan · EU 42", price: "$128.00" }),
        productLine(p, { image: stockSquare("tee"), name: "Linen crew tee", meta: "Sand · M · ×2", price: "$84.00" }),
        productLine(p, { image: stockSquare("watch"), name: "Field watch", meta: "Steel · 38 mm", price: "$240.00" }),
        spacer(12),
        ...bands.summary(p, {
          heading: "Order summary",
          meta: "{{order_date}}",
          lines: [
            { label: "Subtotal", value: "$452.00" },
            { label: "Shipping", value: "Free" },
            { label: "Tax", value: "$36.16" },
          ],
          total: { label: "Total charged", value: "$488.16" },
        }),
        ...bands.eventDetails(p, {
          title: "Delivery",
          rows: [
            { icon: "truck", label: "Arrives", value: "{{delivery_window}}" },
            { icon: "map-pin", label: "Ships to", value: "{{shipping_address}}" },
            { icon: "credit-card", label: "Paid with", value: "Visa ending 4421" },
          ],
        }),
        ...bands.buttonBand(p, { cta: { label: "View your order", href: "{{order_url}}" }, note: "Need to change the address? You can until it ships." }),
        ...bands.signoff(p, { help: "Questions about your order? Reply to this email and a real person will help.", signature: "The Alder & Finch team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// One-time code — indigo, the code big and centred, nothing else to do
// ---------------------------------------------------------------------------
const oneTimeCode = (() => {
  const p = palette("indigo");
  return {
    key: "one-time-code",
    name: "One-time code",
    category: "transactional" as const,
    subject: "{{code}} is your Northwind sign-in code",
    sampleValues: { code: "482 913", expiry_minutes: "10", device: "Chrome on macOS · Lisbon, Portugal" },
    design: sampleDocument({
      key: "otp",
      category: "transactional",
      previewText: "Your code is {{code}}. It expires in {{expiry_minutes}} minutes.",
      palette: p,
      variables: inputs("code", "expiry_minutes", "device"),
      blocks: [
        ...bands.headerWordmark(p, { name: "Northwind" }),
        ...bands.heroStatus(p, {
          icon: "key-round",
          overline: "Sign-in code",
          title: "Here's your code",
          line: "Enter it on the sign-in screen to continue. It only works once.",
          tone: "neutral",
        }),
        ...bands.codeCard(p, { label: "Your one-time code", code: "{{code}}", note: "Expires in {{expiry_minutes}} minutes" }),
        ...bands.callout(p, {
          overline: "Didn't request this?",
          title: "Someone may have typed your email by mistake",
          body: "This request came from {{device}}. If that wasn't you, you can ignore this email: nobody can sign in without the code.",
        }),
        ...bands.signoff(p, { help: "Northwind will never ask you for this code by phone or chat.", small: "This is an automated message from Northwind. You're receiving it because someone tried to sign in with this address." }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Delivery update — emerald, a timeline of the parcel's progress
// ---------------------------------------------------------------------------
const deliveryUpdate = (() => {
  const p = palette("emerald");
  const brand = { name: "Alder & Finch" };
  return {
    key: "delivery-update",
    name: "Out for delivery",
    category: "transactional" as const,
    subject: "Your order {{order_number}} is out for delivery",
    sampleValues: {
      first_name: "Maya",
      order_number: "#A-10482",
      delivery_window: "today, between 12:00 and 16:00",
      shipping_address: "14 Harbour Lane, Apt 3, Bristol BS1 4QA",
      track_url: `${EX}/track/1Z999AA10123456784`,
    },
    design: sampleDocument({
      key: "delivery",
      category: "transactional",
      previewText: "Your parcel is on the van and arrives {{delivery_window}}.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("order_number", "delivery_window", "shipping_address", "track_url")],
      blocks: [
        ...bands.headerWordmark(p, brand, { label: "Order {{order_number}}" }),
        ...bands.heroHeadline(p, {
          overline: "Out for delivery",
          title: "Arriving {{delivery_window}}",
          lead: "Hi {{first_name}}, your order is on the van. Someone may need to sign for it.",
          cta: { label: "Track your parcel", href: "{{track_url}}" },
        }),
        divider(p.border),
        spacer(18),
        band([h2("Where it's been", p.ink, { marginBottom: 0 })], { paddingY: 0 }),
        spacer(4),
        ...timeline(p, [
          { title: "Order placed", line: "Wed 5 Nov, 09:12", state: "done" },
          { title: "Packed and shipped", line: "Thu 6 Nov, 17:40 · Bristol depot", state: "done" },
          { title: "Out for delivery", line: "Today · on the van since 08:05", state: "current" },
          { title: "Delivered", line: "We'll email you when it's at the door", state: "todo" },
        ]),
        spacer(14),
        ...bands.eventDetails(p, {
          title: "Delivery details",
          rows: [
            { icon: "map-pin", label: "Delivering to", value: "{{shipping_address}}" },
            { icon: "package", label: "Parcels", value: "1 box · 2.4 kg" },
            { icon: "clock", label: "Can't be in?", value: "Leave a note for the driver or pick a safe place in tracking." },
          ],
          link: { label: "Change delivery instructions →", href: "{{track_url}}" },
        }),
        ...bands.signoff(p, { help: "Problem with the delivery? Reply here and we'll chase it with the courier.", signature: "The Alder & Finch team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Appointment reminder — teal, the details rows + reschedule link
// ---------------------------------------------------------------------------
const appointmentReminder = (() => {
  const p = palette("teal");
  return {
    key: "appointment-reminder",
    name: "Appointment reminder",
    category: "transactional" as const,
    subject: "Reminder: your appointment on {{appointment_date}}",
    sampleValues: {
      first_name: "Daniel",
      appointment_date: "Thursday 12 November",
      appointment_time: "10:30 – 11:00",
      practitioner: "Dr Hannah Okafor",
      location: "Parkside Clinic, 22 Elm Row, Edinburgh EH7 4AA",
      calendar_url: `${EX}/appointments/88213/calendar.ics`,
      reschedule_url: `${EX}/appointments/88213`,
    },
    design: sampleDocument({
      key: "appt",
      category: "transactional",
      previewText: "{{appointment_date}} at {{appointment_time}} with {{practitioner}}. Reply or reschedule any time.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("appointment_date", "appointment_time", "practitioner", "location", "calendar_url", "reschedule_url")],
      blocks: [
        ...bands.headerWordmark(p, { name: "Parkside Clinic" }, { label: "Reminder" }),
        ...bands.heroHeadline(p, {
          overline: "Coming up",
          title: "See you on {{appointment_date}}",
          lead: "Hi {{first_name}}, this is a reminder of your appointment. Please arrive five minutes early so we can check you in.",
          cta: { label: "Add to calendar", href: "{{calendar_url}}" },
        }),
        ...bands.eventDetails(p, {
          title: "Your appointment",
          rows: [
            { icon: "calendar", label: "Date", value: "{{appointment_date}}" },
            { icon: "clock", label: "Time", value: "{{appointment_time}}" },
            { icon: "user", label: "With", value: "{{practitioner}}" },
            { icon: "map-pin", label: "Where", value: "{{location}}" },
          ],
          link: { label: "Reschedule or cancel →", href: "{{reschedule_url}}" },
        }),
        ...bands.callout(p, {
          title: "Before you come",
          body: "Bring a photo ID and any medication you're taking. If you feel unwell on the day, reschedule online and we'll find you the next free slot.",
        }),
        ...bands.signoff(p, { help: "Running late? Reply to this email or call the front desk on 0131 555 0147.", signature: "Parkside Clinic" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Payment failed — amber, the facts, what happens next, one fix button
// ---------------------------------------------------------------------------
const paymentFailed = (() => {
  const p = palette("amber");
  return {
    key: "payment-failed",
    name: "Payment failed",
    category: "transactional" as const,
    subject: "Action needed: your payment for {{plan_name}} didn't go through",
    sampleValues: {
      first_name: "Ada",
      plan_name: "Pro",
      amount: "$29.00",
      card_last4: "4421",
      retry_date: "9 Nov 2026",
      grace_end_date: "15 Nov 2026",
      update_url: `${EX}/billing/payment-method`,
    },
    design: sampleDocument({
      key: "dunning",
      category: "transactional",
      previewText: "We couldn't charge the card ending {{card_last4}}. Update it by {{grace_end_date}} to keep your plan.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("plan_name", "amount", "card_last4", "retry_date", "grace_end_date", "update_url")],
      blocks: [
        ...bands.headerWordmark(p, { name: "Lumen" }, { label: "Billing" }),
        ...bands.heroStatus(p, {
          icon: "circle-alert",
          overline: "Payment unsuccessful",
          title: "Your card was declined",
          line: "Hi {{first_name}}, we tried to charge {{amount}} for your {{plan_name}} plan and the bank said no. Nothing has changed yet.",
          tone: "neutral",
        }),
        ...bands.summary(p, {
          heading: "Attempted charge",
          meta: "Attempt 1 of 3",
          lines: [
            { label: "Plan", value: "{{plan_name}}" },
            { label: "Card", value: "Visa ending {{card_last4}}" },
            { label: "Next retry", value: "{{retry_date}}" },
          ],
          total: { label: "Amount due", value: "{{amount}}" },
        }),
        ...bands.buttonBand(p, { cta: { label: "Update payment method", href: "{{update_url}}" }, note: "Takes a minute. We'll retry straight away once it's updated." }),
        ...bands.iconRows(p, {
          title: "What happens next",
          rows: [
            { icon: "refresh-cw", title: "We'll retry automatically", line: "Once on {{retry_date}}, and again two days later." },
            { icon: "hourglass", title: "Your plan stays on until {{grace_end_date}}", line: "Nothing is paused and nothing is deleted in the meantime." },
            { icon: "circle-help", title: "Common causes", line: "An expired card, a spending limit, or a bank that wants you to approve the charge." },
          ],
        }),
        ...bands.signoff(p, { help: "Already fixed it, or think this is a mistake? Reply to this email and we'll sort it out.", signature: "The Lumen billing team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Usage alert — violet, a real progress bar and the numbers
// ---------------------------------------------------------------------------
const usageAlert = (() => {
  const p = palette("violet");
  return {
    key: "usage-alert",
    name: "Usage limit warning",
    category: "transactional" as const,
    subject: "You've used {{percent_used}}% of your {{plan_name}} plan",
    sampleValues: {
      first_name: "Ada",
      workspace_name: "Northwind Labs",
      plan_name: "Starter",
      percent_used: "82",
      used: "41,200",
      limit: "50,000",
      reset_date: "1 Dec 2026",
      upgrade_url: `${EX}/settings/billing`,
    },
    design: sampleDocument({
      key: "usage",
      category: "transactional",
      previewText: "{{used}} of {{limit}} sends used. Your allowance resets on {{reset_date}}.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("workspace_name", "plan_name", "percent_used", "used", "limit", "reset_date", "upgrade_url")],
      blocks: [
        ...bands.headerWordmark(p, { name: "Northwind" }, { label: "{{workspace_name}}" }),
        ...bands.heroHeadline(p, {
          overline: "Usage",
          title: "You're at {{percent_used}}% of your plan",
          lead: "Hi {{first_name}}, {{workspace_name}} has used {{used}} of its {{limit}} monthly sends. At the current pace you'll hit the limit before it resets on {{reset_date}}.",
        }),
        ...progressBar(p, 82, { label: "Sends this month", value: "{{used}} / {{limit}}" }),
        spacer(28),
        ...bands.stats(p, {
          items: [
            { value: "{{percent_used}}%", label: "used" },
            { value: "8,800", label: "left this month" },
            { value: "11 days", label: "until reset" },
          ],
        }),
        ...bands.callout(p, {
          overline: "What happens at 100%",
          title: "Sends queue instead of failing",
          body: "When the allowance runs out, new sends wait until the reset or until you upgrade. Transactional email keeps a small emergency reserve so sign-in codes and receipts still go out.",
        }),
        ...bands.buttonBand(p, { cta: { label: "Upgrade {{workspace_name}}", href: "{{upgrade_url}}" }, note: "Upgrades apply immediately and are prorated for the rest of the month." }),
        ...bands.signoff(p, { help: "Expecting a spike? Reply and we'll raise the limit temporarily.", signature: "The Northwind team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Export ready — ink, a file to download before it expires
// ---------------------------------------------------------------------------
const exportReady = (() => {
  const p = palette("ink");
  return {
    key: "export-ready",
    name: "Export ready",
    category: "transactional" as const,
    subject: "Your {{export_name}} export is ready",
    sampleValues: {
      first_name: "Ada",
      export_name: "Contacts",
      file_name: "contacts-2026-11-05.csv",
      row_count: "128,406",
      file_size: "18.2 MB",
      expires_at: "12 Nov 2026",
      download_url: `${EX}/exports/9f2c1a/download`,
    },
    design: sampleDocument({
      key: "export",
      category: "transactional",
      previewText: "{{file_name}} ({{file_size}}) is ready to download. The link works until {{expires_at}}.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("export_name", "file_name", "row_count", "file_size", "expires_at", "download_url")],
      blocks: [
        ...bands.headerWordmark(p, { name: "Northwind" }),
        ...bands.heroStatus(p, {
          icon: "download",
          overline: "Export complete",
          title: "Your {{export_name}} export is ready",
          line: "Hi {{first_name}}, the file you asked for has finished building. Grab it before the link expires.",
        }),
        ...bands.summary(p, {
          heading: "File",
          meta: "Built today",
          lines: [
            { label: "Name", value: "{{file_name}}" },
            { label: "Rows", value: "{{row_count}}" },
            { label: "Size", value: "{{file_size}}" },
          ],
          total: { label: "Link expires", value: "{{expires_at}}" },
        }),
        ...bands.buttonBand(p, { cta: { label: "Download the file", href: "{{download_url}}" }, note: "The link is tied to your account. Anyone else who opens it will be asked to sign in." }),
        ...bands.signoff(p, { help: "Need it again later? Start a new export from the Contacts page any time.", signature: "The Northwind team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Booking confirmation — navy, a hotel photo, check-in details, total
// ---------------------------------------------------------------------------
const bookingConfirmation = (() => {
  const p = palette("navy");
  return {
    key: "booking-confirmation",
    name: "Booking confirmation",
    category: "transactional" as const,
    subject: "You're booked: {{property_name}}, {{check_in}}",
    sampleValues: {
      first_name: "Sofia",
      property_name: "Crescent House, Lisbon",
      confirmation_code: "KL-7Q2M9",
      check_in: "Fri 20 Nov",
      check_out: "Mon 23 Nov",
      guests: "2 adults",
      total: "€612.00",
      manage_url: `${EX}/bookings/KL-7Q2M9`,
    },
    design: sampleDocument({
      key: "booking",
      category: "transactional",
      previewText: "Confirmation {{confirmation_code}}. {{check_in}} to {{check_out}}, {{guests}}.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("property_name", "confirmation_code", "check_in", "check_out", "guests", "total", "manage_url")],
      blocks: [
        ...bands.headerWordmark(p, { name: "Keel" }, { label: "{{confirmation_code}}" }),
        ...bands.heroMedia(p, {
          image: stockWide("apartment"),
          alt: "{{property_name}}",
          overline: "Booking confirmed",
          title: "You're off to Lisbon, {{first_name}}",
          lead: "{{property_name}} is booked. Your host has your arrival time and will send check-in instructions the day before.",
        }),
        ...bands.eventDetails(p, {
          title: "Your stay",
          rows: [
            { icon: "calendar-check", label: "Check-in", value: "{{check_in}} · from 15:00" },
            { icon: "calendar-x", label: "Check-out", value: "{{check_out}} · by 11:00" },
            { icon: "users", label: "Guests", value: "{{guests}}" },
            { icon: "map-pin", label: "Address", value: "Rua da Prata 142, 1100-420 Lisboa" },
          ],
        }),
        ...bands.summary(p, {
          heading: "Payment",
          meta: "Paid in full",
          lines: [
            { label: "3 nights × €180", value: "€540.00" },
            { label: "Cleaning fee", value: "€45.00" },
            { label: "City tax", value: "€27.00" },
          ],
          total: { label: "Total", value: "{{total}}" },
        }),
        ...bands.buttonBand(p, { cta: { label: "Manage booking", href: "{{manage_url}}" }, note: "Free cancellation until 48 hours before check-in." }),
        ...bands.signoff(p, { help: "Questions about the place? Message your host from the booking page and they'll reply within a few hours.", signature: "The Keel team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Support reply — sky, an agent's message quoted with their photo
// ---------------------------------------------------------------------------
const supportReply = (() => {
  const p = palette("sky");
  return {
    key: "support-reply",
    name: "Support reply",
    category: "transactional" as const,
    subject: "Re: {{ticket_subject}} [#{{ticket_id}}]",
    sampleValues: {
      first_name: "Ada",
      ticket_id: "4821",
      ticket_subject: "Webhook retries stopped overnight",
      agent_name: "Priya Natarajan",
      agent_role: "Support engineer",
      reply_body: "Thanks for the detail. The retries stopped because your endpoint started answering 410 at 02:14, which we treat as 'stop sending'. I've re-enabled the endpoint and replayed the 37 events from that window. Could you confirm they've arrived?",
      ticket_url: `${EX}/support/tickets/4821`,
    },
    design: sampleDocument({
      key: "support",
      category: "transactional",
      previewText: "{{agent_name}} replied to your request about {{ticket_subject}}.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("ticket_id", "ticket_subject", "agent_name", "agent_role", "reply_body", "ticket_url")],
      blocks: [
        ...bands.headerWordmark(p, { name: "Northwind Support" }, { label: "Ticket #{{ticket_id}}" }),
        ...bands.heroHeadline(p, {
          overline: "New reply",
          title: "{{agent_name}} replied",
          lead: "Hi {{first_name}}, there's an update on your request: {{ticket_subject}}.",
        }),
        personRow(p, { image: stockAvatar("portraitWoman2"), name: "{{agent_name}}", meta: "{{agent_role}} · just now" }),
        spacer(16),
        band(
          [
            section([copy("{{reply_body}}", p.body, { marginBottom: 0 })], {
              backgroundColor: p.tint,
              paddingX: 22,
              paddingY: 18,
              border: { width: 1, style: "solid", color: p.border, radius: 14 },
            }),
          ],
          { paddingY: 0 },
        ),
        ...bands.buttonBand(p, { cta: { label: "Reply on the ticket", href: "{{ticket_url}}" }, note: "Or just reply to this email. Your answer lands on the same ticket." }),
        ...bands.signoff(p, { help: "We're here Monday to Friday, 08:00 to 20:00 UTC. Urgent outage? Mark the ticket as urgent and we'll page someone.", small: "Ticket #{{ticket_id}} · {{ticket_subject}}" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Weekly report — emerald, "your week in numbers" with stats and top items
// ---------------------------------------------------------------------------
const weeklyReport = (() => {
  const p = palette("emerald");
  return {
    key: "weekly-report",
    name: "Weekly report",
    category: "transactional" as const,
    subject: "Your week in numbers: {{week_label}}",
    sampleValues: {
      first_name: "Ada",
      workspace_name: "Northwind Labs",
      week_label: "27 Oct – 2 Nov",
      sent: "24,180",
      delivery_rate: "99.2%",
      open_rate: "41.7%",
      dashboard_url: `${EX}/dashboard`,
    },
    design: sampleDocument({
      key: "weekly",
      category: "transactional",
      previewText: "{{sent}} sent, {{delivery_rate}} delivered, {{open_rate}} opened. Here's what moved.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("workspace_name", "week_label", "sent", "delivery_rate", "open_rate", "dashboard_url")],
      blocks: [
        ...bands.headerWordmark(p, { name: "Northwind" }, { label: "{{week_label}}" }),
        ...bands.heroHeadline(p, {
          overline: "Weekly report",
          title: "Your week in numbers",
          lead: "Hi {{first_name}}, here's how {{workspace_name}} did last week compared with the week before.",
        }),
        ...bands.stats(p, {
          items: [
            { value: "{{sent}}", label: "emails sent · +12%" },
            { value: "{{delivery_rate}}", label: "delivered · +0.3 pts" },
            { value: "{{open_rate}}", label: "opened · −1.1 pts" },
          ],
        }),
        ...bands.iconRows(p, {
          title: "What moved",
          rows: [
            { icon: "trending-up", title: "Onboarding sequence", line: "Clicks up 18% after the new day-3 email went live on Tuesday." },
            { icon: "mail-check", title: "Domain health", line: "All three sending domains verified. No bounces above 0.4%." },
            { icon: "triangle-alert", title: "One thing to look at", line: "The 'Invoice ready' template had 9 complaints. Check the subject line." },
          ],
        }),
        ...bands.callout(p, {
          overline: "Tip of the week",
          title: "Send receipts from a separate domain",
          body: "Keep transactional mail on its own subdomain so a marketing campaign can never drag down receipts and sign-in codes.",
          link: { label: "Read the guide →", href: `${EX}/guides/sending-domains` },
        }),
        ...bands.buttonBand(p, { cta: { label: "Open the dashboard", href: "{{dashboard_url}}" } }),
        ...bands.signoff(p, { help: "You get this every Monday. Change the schedule or turn it off in Settings → Notifications.", signature: "The Northwind team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Document to sign — slate, who sent what and when it's due
// ---------------------------------------------------------------------------
const documentToSign = (() => {
  const p = palette("slate");
  return {
    key: "document-to-sign",
    name: "Document to sign",
    category: "transactional" as const,
    subject: "{{sender_name}} sent you {{document_name}} to sign",
    sampleValues: {
      first_name: "Jordan",
      sender_name: "Elena Marsh",
      sender_company: "Harbor Design",
      document_name: "Master services agreement",
      due_date: "Fri 14 Nov",
      page_count: "12",
      sign_url: `${EX}/sign/8c1d2f`,
    },
    design: sampleDocument({
      key: "sign",
      category: "transactional",
      previewText: "{{document_name}} from {{sender_company}} is waiting for your signature. Due {{due_date}}.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("sender_name", "sender_company", "document_name", "due_date", "page_count", "sign_url")],
      blocks: [
        ...bands.headerWordmark(p, { name: "Inkwell" }),
        ...bands.heroStatus(p, {
          icon: "pen-line",
          overline: "Signature requested",
          title: "{{sender_name}} needs your signature",
          line: "Hi {{first_name}}, {{sender_name}} at {{sender_company}} sent you a document. Review it and sign in your browser; no account needed.",
          tone: "neutral",
        }),
        ...bands.eventDetails(p, {
          title: "Document",
          rows: [
            { icon: "file-text", label: "Name", value: "{{document_name}} · {{page_count}} pages" },
            { icon: "user", label: "From", value: "{{sender_name}}, {{sender_company}}" },
            { icon: "calendar-clock", label: "Due", value: "{{due_date}}" },
          ],
        }),
        ...bands.buttonBand(p, { cta: { label: "Review and sign", href: "{{sign_url}}" }, note: "The link is unique to you. Don't forward this email." }),
        ...bands.callout(p, {
          title: "Not expecting this?",
          body: "You can decline from the document page and {{sender_name}} will be told. Nothing is signed until you draw or type your signature and confirm.",
        }),
        ...bands.signoff(p, { help: "Questions about the contents? Reply to this email and it goes straight to {{sender_name}}.", small: "Sent via Inkwell on behalf of {{sender_company}}." }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Review request — rose, the product, one-tap stars, a review button
// ---------------------------------------------------------------------------
const reviewRequest = (() => {
  const p = palette("rose");
  return {
    key: "review-request",
    name: "Review request",
    category: "transactional" as const,
    subject: "How's your {{product_name}}, {{first_name}}?",
    sampleValues: {
      first_name: "Maya",
      product_name: "Court sneaker",
      order_number: "#A-10482",
      review_url: `${EX}/review/A-10482`,
    },
    design: sampleDocument({
      key: "review",
      category: "transactional",
      previewText: "Tap a star to rate your {{product_name}}. Takes ten seconds.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("product_name", "order_number", "review_url")],
      blocks: [
        ...bands.headerWordmark(p, { name: "Alder & Finch" }, { label: "Order {{order_number}}" }),
        ...bands.heroHeadline(p, {
          overline: "A week in",
          title: "How's the {{product_name}}?",
          lead: "Hi {{first_name}}, you've had it a week now. A quick rating helps the next person decide, and tells us what to make more of.",
        }),
        band(
          [
            section(
              [
                { ...icon("shirt", "soft", { align: "center", marginBottom: 12 }) },
                text("{{product_name}}", { align: "center", fontSize: 17, fontWeight: "600", color: p.ink, marginBottom: 4 }),
                text("Delivered 9 Nov · Order {{order_number}}", { align: "center", fontSize: 13, color: p.muted, marginBottom: 0 }),
              ],
              { backgroundColor: p.tint, paddingX: 24, paddingY: 22, border: { width: 1, style: "solid", color: p.border, radius: 14 } },
            ),
          ],
          { paddingY: 0 },
        ),
        spacer(24),
        band([text("Tap a star to rate it", { align: "center", fontSize: 14, fontWeight: "600", color: p.ink, marginBottom: 0 })], { paddingY: 0 }),
        spacer(12),
        starRow("{{review_url}}"),
        spacer(24),
        ...bands.buttonBand(p, { cta: { label: "Write a short review", href: "{{review_url}}" }, align: "center", note: "Two sentences is plenty. Photos are welcome." }),
        ...bands.signoff(p, { help: "Something not right with it? Reply to this email first and we'll make it right.", signature: "The Alder & Finch team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Password changed — ink, the confirmation every account product sends
// ---------------------------------------------------------------------------
const passwordChanged = (() => {
  const p = palette("ink");
  return {
    key: "password-changed",
    name: "Password changed",
    category: "transactional" as const,
    subject: "Your Northwind password was changed",
    sampleValues: {
      first_name: "Ada",
      changed_at: "Today at 09:41 UTC",
      device: "Chrome on macOS",
      location: "Lisbon, Portugal",
      secure_url: `${EX}/account/security`,
    },
    design: sampleDocument({
      key: "pwchanged",
      category: "transactional",
      previewText: "Changed {{changed_at}} from {{device}}. If that wasn't you, secure your account now.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("changed_at", "device", "location", "secure_url")],
      blocks: [
        ...bands.headerWordmark(p, { name: "Northwind" }, { label: "Security" }),
        ...bands.heroStatus(p, {
          icon: "shield-check",
          overline: "Password updated",
          title: "Your password was changed",
          line: "Hi {{first_name}}, this is a confirmation that the password on your account was changed. If you did this, there's nothing else to do.",
        }),
        ...bands.eventDetails(p, {
          title: "Change details",
          rows: [
            { icon: "clock", label: "When", value: "{{changed_at}}" },
            { icon: "laptop", label: "Device", value: "{{device}}" },
            { icon: "map-pin", label: "Approximate location", value: "{{location}}" },
          ],
        }),
        ...bands.callout(p, {
          overline: "Wasn't you?",
          title: "Lock your account in one step",
          body: "Secure your account to reset the password, sign out every other session and review recent activity. Do it from the link below, not from any other email.",
          link: { label: "Secure my account →", href: "{{secure_url}}" },
        }),
        ...bands.signoff(p, { help: "Northwind will never ask for your password by email, phone or chat.", small: "You're receiving this because security notices can't be turned off." }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Subscription cancelled — ink, graceful exit, what they keep, one way back
// ---------------------------------------------------------------------------
const subscriptionCancelled = (() => {
  const p = palette("ink");
  return {
    key: "subscription-cancelled",
    name: "Subscription cancelled",
    category: "transactional" as const,
    subject: "Your {{plan_name}} plan is cancelled",
    sampleValues: {
      first_name: "Ada",
      plan_name: "Pro",
      access_until: "1 Dec 2026",
      resubscribe_url: `${EX}/settings/billing`,
      export_url: `${EX}/settings/export`,
    },
    design: sampleDocument({
      key: "cancel",
      category: "transactional",
      previewText: "You keep {{plan_name}} until {{access_until}}. Nothing is deleted.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("plan_name", "access_until", "resubscribe_url", "export_url")],
      blocks: [
        ...bands.headerWordmark(p, { name: "Northwind" }),
        ...bands.heroHeadline(p, {
          overline: "Cancellation confirmed",
          title: "Sorry to see you go, {{first_name}}",
          lead: "Your {{plan_name}} plan is cancelled and you won't be charged again. You keep every {{plan_name}} feature until {{access_until}}.",
        }),
        ...bands.iconRows(p, {
          title: "What happens now",
          rows: [
            { icon: "calendar-check", title: "Until {{access_until}}", line: "Everything works as it does today." },
            { icon: "package-open", title: "After that", line: "Your workspace moves to the free plan. Templates, contacts and history stay put." },
            { icon: "download", title: "Your data is yours", line: "Export contacts, templates and sends at any time, on any plan." },
          ],
        }),
        band([link("Export my data →", "{{export_url}}", p.accentText)], { paddingY: 0 }),
        spacer(28),
        ...bands.ctaContrast(p, {
          title: "Changed your mind?",
          line: "Reactivate in one click. Your settings and history are exactly as you left them.",
          cta: { label: "Keep my {{plan_name}} plan", href: "{{resubscribe_url}}" },
        }),
        ...bands.signoff(p, { help: "If something didn't work for you, reply and tell us. We read every one and it changes what we build.", signature: "The Northwind team" }),
      ],
    }),
  };
})();

export const TRANSACTIONAL_V2: readonly SampleTemplate[] = [
  orderConfirmation,
  oneTimeCode,
  deliveryUpdate,
  appointmentReminder,
  paymentFailed,
  usageAlert,
  exportReady,
  bookingConfirmation,
  supportReply,
  weeklyReport,
  documentToSign,
  reviewRequest,
  passwordChanged,
  subscriptionCancelled,
];

// Keep the unused-import list honest when a helper is only used by the sibling file.
void h3;
void list;
void overline;
void small;
