# Client Questions

Questions to ask the photographer to fill the gaps in the brief, grouped by topic. Plain language, ready to send/ask directly.

## Fees & Payments
- What is the booking fee — a fixed amount for every booking, or a percentage of the service price?
- Is the booking fee refundable if the client cancels? If so, under what conditions (e.g. cancels X days before the date)?
- What happens if the client is a no-show, or the photographer needs to cancel/reschedule?
- Is the session fee a fixed remainder of the total price, or calculated separately after the shoot (e.g. if the client wants extra photos)?
- Do you want to accept card payments in addition to Mobile Money (MTN MoMo / Airtel Money), for example for clients paying from outside Rwanda?
- Should the booking be held as "confirmed" only once the booking fee is actually paid, or as soon as the client submits the request?

## Booking & Availability
- How far in advance can clients book (e.g. minimum 2 days notice)?
- Should bookings be auto-confirmed once the date is available and the fee is paid, or do you want to manually approve every request first?
- Do you want to block specific time slots within a day (e.g. mornings only) or just full days?
- Do you currently use Google Calendar or another calendar app you'd like the site to sync with, or is the site itself replacing that entirely?

## Services & Pricing
- Roughly how many services will you list, and can you give a few examples with their pricing logic (e.g. "1-hour product shoot, 20 photos — X RWF")?
- Do prices need to change seasonally or be different for different types of clients (e.g. businesses vs individuals)?
- Can you provide your current pricing model for your services?

## Client Experience
- Should clients create an account to track their bookings and re-download photos later, or is a simple guest booking (name, email, phone) enough?
- What details do you need from a client at booking time (e.g. shoot type, location, number of people, special requests)?

## Photo Delivery
- After the shoot, do you want to upload photos directly to the website (so the site stores and links to them), or will you continue uploading elsewhere (Google Drive, Dropbox, WeTransfer) and just paste the link into the site to email the client?
- Should download links expire after some time, or stay available indefinitely?
- Where do the photos live before/after delivery — do you edit and keep them on your own laptop/hard drive and only upload a copy when it's time to deliver, or do you want them to stay stored online (on the site) after delivery too? Should photos be automatically deleted from the site/storage after a certain time, or kept indefinitely?
- When uploading, would you rather upload photos individually/in bulk (select many image files at once), or upload one zipped file containing all the photos for a shoot?

## Business Details
- What's the business/brand name you'd like on the site?
- Do you have a logo, brand colors, or existing social media/portfolio to link to?
- Should prices be shown in RWF, USD, or both?
- Do you need the site in English only, or also Kinyarwanda?

## Communication
- Besides email, would you want booking confirmations/reminders sent via SMS or WhatsApp?
- Who should receive the "new booking request" alert — just you?

---

# Technical Suggestions (for the developer to consider/propose)

These aren't things to ask the client verbatim — they're implementation options worth having an opinion on or raising as recommendations once the answers above are known.

- **Payment gateway**: For Mobile Money in Rwanda, look at aggregators like Flutterwave, Pesapal, or IntouchPay/PaySika — they support MTN MoMo and Airtel Money and typically offer card support as an add-on, which covers the open "card payments?" question with one integration.
- **Booking confirmation logic**: Consider holding a slot as "pending" for a short window (e.g. 30 min) after a booking request while the client completes the Mobile Money payment, then auto-releasing the slot if payment isn't completed — this avoids a slot being soft-locked indefinitely by an abandoned request.
- **Calendar sync**: A simple internal availability calendar (dates/slots stored in the app's own database) is enough for launch; two-way Google Calendar sync is a nice-to-have that adds real complexity (OAuth, webhook sync, conflict resolution) and can be phased in later.
- **Pricing model design** — the brief says pricing is "based on number of photos and time, etc.", which needs a concrete data model. His current pricing sheet (the "pricing model" question above) will tell us which of these fits, but the options are:
  - **A. Flat price per service.** Each service (e.g. "Product shoot") has one fixed price.
    - Advantages: simplest possible build — one price field per service; trivial for the admin to manage and for the site to display.
    - Setbacks: doesn't capture variation by hours/photo count without creating many near-duplicate services (a "2-hour shoot" and "3-hour shoot" as separate listings), which gets messy fast and is easy to mismanage.
  - **B. Formula/variable-based pricing.** A service has a base price plus variables (e.g. rate per extra hour, rate per extra 10 photos, optional add-ons), and the final price is calculated from what the client selects at booking.
    - Advantages: matches "priced based on number of photos and time" most directly; one service definition covers many configurations instead of duplicating services; scales cleanly as he adds more variables later.
    - Setbacks: meaningfully more dev work — needs a pricing-calculator UI, a live price preview for the client, and server-side validation that the submitted price matches the formula (so a client can't tamper with the price client-side).
  - **C. Package/tiered pricing.** Each service offers 2–3 predefined packages (e.g. Basic/Standard/Premium), each a fixed bundle of price + photo count + duration.
    - Advantages: much simpler to build than B while still giving some flexibility; easy for clients to understand and pick from; easy for the admin to set up (define a few packages per service) without a pricing-formula engine.
    - Setbacks: less granular than true variable pricing — a client can't dial in an exact photo count or duration outside the predefined tiers.
  - **Recommendation: start with C.** It captures the "priced by photo count/time" intent from the brief without building a full pricing-formula engine, is fast to implement, and is easy to evolve into B later once his actual pricing sheet is in hand — if it turns out to already be a simple formula (e.g. "$X/hour + $Y per 10 photos"), it may be worth building B directly instead of a tiered approximation of it.
- **Photo delivery** — three options:
  - **A. Built-in storage** (e.g. S3/Cloudinary, with signed expiring download links generated by the site).
    - Advantages: professional/branded experience end-to-end; admin controls link expiry and can see download activity; no dependency on a third-party service's sharing quirks or quotas.
    - Setbacks: real infrastructure cost (storage + bandwidth, especially for large RAW/high-res sets); more upfront dev work (upload flow, storage integration, expiry logic).
  - **B. External link only** (Drive/Dropbox/WeTransfer), admin pastes the link into the site's email tool.
    - Advantages: near-zero storage cost; fastest to build (just a text field + "send email" action); photographer keeps using tools he may already know.
    - Setbacks: less polished/branded client experience; admin does a manual step each time; no built-in expiry or download tracking; relies on the third-party service staying up and within its free-tier limits.
  - **C. Hybrid** — external storage for the actual files (v1), but the *site* owns the delivery step: admin pastes/generates the link into a site field, and the site sends a branded email with that link (rather than the admin emailing manually from Gmail/WhatsApp).
    - Advantages: same near-zero cost and fast build as B, but the client experience stays consistent and branded; the delivery step becomes structured data the system can track (e.g. "delivered on X date"); leaves a clean path to swap in built-in storage (A) later without re-architecting the booking/email flow.
    - Setbacks: still inherits B's reliance on a third-party host and lack of native expiry/download tracking.
  - **Recommendation: C.** It gets the branding and workflow-tracking benefits of a built-in system at essentially B's cost and build time, and doesn't lock out upgrading to A later if the client's volume or expectations grow.
  - **On Cloudinary specifically** (if going with A or C's storage layer): generous free tier for early-stage volume, native signed/expiring download links (solves the link-expiry question directly), and built-in thumbnail/preview generation with little extra code. Downside: pricing is bandwidth-driven, so delivering many full-resolution galleries every month could get expensive faster than typical "serve small optimized images" Cloudinary use cases; it's not built for zipped batch downloads or RAW files. A reasonable default for launch, worth reassessing only if volume/bandwidth costs grow.
  - **Bulk images vs. a single zip file** changes the cheapest storage choice, since a zip shifts the cost from many small optimized images to one large binary blob that gets downloaded whole:
    - If the client uploads **individual images in bulk**: Cloudinary (above) stays a good fit — it's built for exactly this (many images, thumbnails/previews, per-image transforms).
    - If the client uploads a **single zip per shoot**: bandwidth (egress), not storage, becomes the dominant cost, since every client download pulls the whole zip. **Cloudflare R2** is the cheapest option here — $0.015/GB-month storage and **zero egress fees**, so a 1–2GB zip downloaded repeatedly costs nothing extra in bandwidth; it's S3-compatible, so integration is the same as any S3 SDK. **Backblaze B2** is a close second (similarly cheap storage, free egress only when paired with Cloudflare's CDN). Cloudinary is a weaker fit for zips specifically — it treats non-image files as "raw" uploads without special handling, and its free-tier bandwidth gets consumed fast by large binary downloads.
    - **Recommendation**: if zip upload is chosen, use Cloudflare R2 for storage — cheapest at scale precisely because zip downloads are bandwidth-heavy and R2 charges nothing for egress.
- **Photo storage lifecycle / retention** — once delivery method is picked, retention still needs a policy:
  - **A. Keep online indefinitely.**
    - Advantages: client can always come back for a re-download; no risk of "sorry, that expired" support requests months later.
    - Setbacks: storage costs grow forever as bookings accumulate; without cleanup, an S3/Cloudinary bill quietly creeps up over years.
  - **B. Auto-delete from the site/storage after a fixed window** (e.g. 30/60/90 days after delivery), with the photographer's own laptop/hard drive as the long-term archive.
    - Advantages: predictable, bounded storage costs; matches how many photographers already work (edited masters live locally or on a personal backup drive; the site is just a temporary handoff).
    - Setbacks: needs a scheduled cleanup job (cron/background task) to actually delete on time; if a client asks for a re-download after the window, the photographer has to manually resend from their own archive — so the site should probably surface "expires on X" clearly to the client and/or admin beforehand.
  - **Recommendation: B**, with a fairly generous default window (e.g. 60–90 days) and a clear expiry date shown to the client at delivery time. It keeps storage costs bounded and matches the likely real-world workflow (photos are edited and archived locally; the site is a delivery/download layer, not permanent storage) — worth confirming directly with the client since it also answers where his "source of truth" copy of each shoot lives.
- **Accounts vs. guest booking** — three options:
  - **A. Guest booking only**, no accounts (name, email, phone per booking).
    - Advantages: fastest, simplest build; zero login friction for one-time clients; no password-reset/auth support burden.
    - Setbacks: no persistent booking history for the client; nothing to return to except what was emailed at the time; repeat clients re-enter their details every time.
  - **B. Full accounts** (email/password or similar login).
    - Advantages: clients can log in anytime to see booking history and re-download photos; fewer "can you resend that link" support requests.
    - Setbacks: meaningfully more build complexity (auth, password reset, session handling); added signup friction, which matters for a one-off client who just wants to book a shoot; extra data-privacy/security obligations for storing login credentials.
  - **C. Guest booking + a secure "magic link" per booking** (no password; the confirmation email contains a unique link the client can reopen anytime to check status or download photos).
    - Advantages: same low friction as guest booking (no signup step), but the client still gets a persistent, bookmarkable way back into their booking — closer to B's convenience without B's auth overhead.
    - Setbacks: no single unified view across multiple bookings from the same client (each booking has its own link, not a shared account); if the client loses the email, admin has to manually resend it.
  - **Recommendation: C.** It solves the main pain of pure guest booking (nothing to return to) without taking on full account/auth complexity, and matches the scale of a single-photographer business where most clients likely book once or occasionally rather than needing a full account dashboard.
- **Double-booking safety**: Enforce availability checks with a database-level constraint/transaction (not just UI validation) so two simultaneous booking requests for the same slot can't both succeed — a race condition that's easy to miss if only the frontend checks availability.
- **Admin notifications**: Start with email notifications (simplest, reliable); WhatsApp Business API is a strong fit given the client's current WhatsApp usage, but requires Meta approval and a paid provider, so it's worth scoping as a phase 2 item.
