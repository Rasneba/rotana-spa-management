"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Locale = "en" | "am";

type BookingForm = {
  full_name: string;
  phone: string;
  email: string;
  branch: string;
  treatment: string;
  preferred_at: string;
  notes: string;
  notification_channel: string;
  notification_contact: string;
};

type NavItem = { label: string; id: string };

const content = {
  en: {
    nav: [
      { label: "About", id: "about" },
      { label: "Treatments", id: "treatments" },
      { label: "Gallery", id: "gallery" },
      { label: "Branches", id: "branches" },
      { label: "Map", id: "map" },
      { label: "Reviews", id: "reviews" },
      { label: "Gift Cards", id: "gift-cards" },
      { label: "Booking", id: "booking" },
    ] satisfies NavItem[],
    staff: "Staff Portal",
    heroKicker: "Discover Peace. Discover Dagi Spa.",
    heroTitle: "Relaxation with a modern Addis Ababa glow.",
    heroBody: "A refined wellness escape inspired by the original Dagi Spa experience — Moroccan bath rituals, massage therapy, facials, reflexology, and warm hospitality in Bole and Imperial.",
    heroCta: "Reserve your calm",
    secondaryCta: "Explore treatments",
    aboutTitle: "Your sanctuary of luxury, wellness, and renewal",
    aboutBody: "Since 2009, Dagi Spa has welcomed guests into calm spaces where skilled hands, clean facilities, and thoughtful details transform the day. Every visit is designed to leave you refreshed, restored, and renewed.",
    call: "Call Anytime",
    treatmentsTitle: "Signature wellness experiences",
    branchesTitle: "Two elegant branches, one Dagi standard",
    reviewsTitle: "Real stories from refreshed guests",
    giftTitle: "Give the gift of relaxation.",
    giftBody: "Treat loved ones to a rejuvenating Dagi Spa gift card — perfect for birthdays, appreciation, couples’ moments, and self-care days.",
    bookingTitle: "Request a booking",
    bookingBody: "Send your preferred branch, service, and time. Our reception team confirms availability before creating any appointment or payment.",
    submit: "Send booking request",
    success: "Thank you. Your request was received and our team will contact you to confirm availability.",
    footer: "Where every visit is a journey to inner peace, outer beauty, and total well-being.",
    fields: {
      full_name: "Full name",
      phone: "Phone",
      email: "Email",
      branch: "Branch",
      treatment: "Treatment",
      preferred_at: "Preferred date/time",
      notes: "Notes",
    },
  },
  am: {
    nav: [
      { label: "ስለ እኛ", id: "about" },
      { label: "አገልግሎቶች", id: "treatments" },
      { label: "ጋለሪ", id: "gallery" },
      { label: "ቅርንጫፎች", id: "branches" },
      { label: "ካርታ", id: "map" },
      { label: "አስተያየቶች", id: "reviews" },
      { label: "የስጦታ ካርድ", id: "gift-cards" },
      { label: "ቦታ ማስያዝ", id: "booking" },
    ] satisfies NavItem[],
    staff: "የሰራተኞች መግቢያ",
    heroKicker: "ሰላምን ያግኙ። Dagi Spaን ያግኙ።",
    heroTitle: "በአዲስ አበባ ዘመናዊ እና የተረጋጋ የስፓ ተሞክሮ።",
    heroBody: "በDagi Spa የሞሮካን ባዝ፣ ማሳጅ፣ ፊያሻል፣ ሪፍሌክሶሎጂ እና ሙቀት ያለው አገልግሎት በቦሌ እና ኢምፔሪያል ቅርንጫፎቻችን ይጠብቅዎታል።",
    heroCta: "ቦታ ያስይዙ",
    secondaryCta: "አገልግሎቶችን ይመልከቱ",
    aboutTitle: "የቅንጦት፣ የጤና እና የእድሳት መዳረሻዎ",
    aboutBody: "ከ2009 ጀምሮ Dagi Spa እንግዶችን ወደ ሰላማዊ አካባቢ፣ የተማሩ ባለሙያዎች፣ ንጹህ ፋሲሊቲዎች እና የተንከባከበ አገልግሎት ያመጣል።",
    call: "በማንኛውም ጊዜ ይደውሉ",
    treatmentsTitle: "የተመረጡ የዌልነስ አገልግሎቶች",
    branchesTitle: "ሁለት ውብ ቅርንጫፎች፣ አንድ የDagi ደረጃ",
    reviewsTitle: "ከተደሰቱ እንግዶች የተሰሙ አስተያየቶች",
    giftTitle: "የእረፍት ስጦታ ይስጡ።",
    giftBody: "ለልደት፣ ለምስጋና፣ ለጥንዶች ጊዜ ወይም ለራስ እንክብካቤ የሚሆን የDagi Spa የስጦታ ካርድ ይግዙ።",
    bookingTitle: "የቦታ ማስያዝ ጥያቄ",
    bookingBody: "ቅርንጫፍ፣ አገልግሎት እና የሚመችዎትን ጊዜ ይላኩ። ቀጠሮ ወይም ክፍያ ከመፈጠሩ በፊት የሪሴፕሽን ቡድናችን ያረጋግጣል።",
    submit: "ጥያቄ ላክ",
    success: "እናመሰግናለን። ጥያቄዎ ደርሶናል፣ ቡድናችን ለማረጋገጥ ያገናኝዎታል።",
    footer: "እያንዳንዱ ጉብኝት ወደ ውስጣዊ ሰላም፣ ውጫዊ ውበት እና ሙሉ ጤና የሚወስድ ጉዞ ነው።",
    fields: {
      full_name: "ሙሉ ስም",
      phone: "ስልክ",
      email: "ኢሜይል",
      branch: "ቅርንጫፍ",
      treatment: "አገልግሎት",
      preferred_at: "የተመረጠ ቀን/ሰዓት",
      notes: "ማስታወሻ",
    },
  },
};

const treatments = [
  { title: "Moroccan Bath", am: "ሞሮካን ባዝ", body: "Cleanse, exfoliate, steam, and leave your skin glowing.", image: "/dagi/moroccan-bath.jpg", icon: "✦" },
  { title: "Massages", am: "ማሳጅ", body: "Customized massage therapy for tension, balance, and deep calm.", image: "/dagi/massage.jpg", icon: "◆" },
  { title: "Reflexology", am: "ሪፍሌክሶሎጂ", body: "Targeted foot therapy to relieve stress and restore circulation.", image: "/dagi/moroccan-bath.jpg", icon: "●" },
];

const detailedTreatments = [
  {
    title: "Moroccan Bath",
    am: "ሞሮካን ባዝ",
    duration: "60–90 min",
    image: "/dagi/moroccan-bath.jpg",
    details: ["Steam ritual", "Deep exfoliation", "Skin glow finish", "Detox refreshment"],
  },
  {
    title: "Therapeutic Massage",
    am: "ቴራፒዩቲክ ማሳጅ",
    duration: "45–90 min",
    image: "/dagi/massage.jpg",
    details: ["Back & shoulder relief", "Hot stone option", "Couples room option", "Custom pressure"],
  },
  {
    title: "Facial & Beauty Care",
    am: "ፊያሻል እና የውበት እንክብካቤ",
    duration: "45–75 min",
    image: "/dagi/face.jpg",
    details: ["Skin cleansing", "Hydrating mask", "Wax service", "Manicure & pedicure"],
  },
  {
    title: "Reflexology",
    am: "ሪፍሌክሶሎጂ",
    duration: "30–60 min",
    image: "/dagi/yoly.png",
    details: ["Foot pressure points", "Circulation support", "Stress release", "Balance restoration"],
  },
];

const gallery = [
  { title: "Massage Therapy", image: "/dagi/massage.jpg" },
  { title: "Moroccan Bath", image: "/dagi/moroccan-bath.jpg" },
  { title: "Dagi Spa Interior", image: "/dagi/gallery-photo-1.jpg" },
  { title: "Spa Ritual Room", image: "/dagi/gallery-thr.jpg" },
  { title: "Yoly Hotel Branch", image: "/dagi/yoly.png" },
  { title: "Alfoz Plaza Branch", image: "/dagi/alfo.png" },
];

const branches = [
  {
    title: "Yoly Hotel",
    detail: "Near Bole Atlas, Addis Ababa",
    phone: "0912923692 / 0917923692",
    image: "/dagi/yoly.png",
    map: "https://www.google.com/maps?q=Yoly%20Hotel%20Bole%20Atlas%20Addis%20Ababa%20Ethiopia&output=embed",
  },
  {
    title: "Alfoz Plaza",
    detail: "Near Bole Imperial, Addis Ababa",
    phone: "0910888853",
    image: "/dagi/alfo.png",
    map: "https://www.google.com/maps?q=Alfoz%20Plaza%20Bole%20Imperial%20Addis%20Ababa%20Ethiopia&output=embed",
  },
];

const reviews = [
  "The Moroccan bath was beyond relaxing, and the staff’s attention to detail made all the difference.",
  "The hot stone massage is a must-try. Skilled therapists and outstanding customer service.",
  "Facilities are top-notch, professional, and welcoming from the moment you walk in.",
];

const rituals = ["Moroccan Bath", "Massage", "Facial", "Wax", "Hair Salon", "Manicure", "Pedicure"];
const initialForm: BookingForm = { full_name: "", phone: "", email: "", branch: "", treatment: "", preferred_at: "", notes: "", notification_channel: "whatsapp", notification_contact: "" };

function handleTilt(event: React.MouseEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 14;
  const y = ((event.clientY - rect.top) / rect.height - 0.5) * -14;
  event.currentTarget.style.setProperty("--tilt-x", `${y.toFixed(2)}deg`);
  event.currentTarget.style.setProperty("--tilt-y", `${x.toFixed(2)}deg`);
}

function resetTilt(event: React.MouseEvent<HTMLElement>) {
  event.currentTarget.style.setProperty("--tilt-x", "0deg");
  event.currentTarget.style.setProperty("--tilt-y", "0deg");
}

export default function DagiLandingPage({ locale }: { locale: string }) {
  const lang: Locale = locale === "am" ? "am" : "en";
  const t = content[lang];
  const [form, setForm] = useState<BookingForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedGallery, setSelectedGallery] = useState<(typeof gallery)[number] | null>(null);

  const branchOptions = useMemo(() => branches.map((branch) => branch.title), []);
  const treatmentOptions = useMemo(() => treatments.map((treatment) => treatment.title), []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/public/booking-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, locale: lang }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to send booking request");
      setForm(initialForm);
      setMessage(t.success);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send booking request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="dagi-site dagi-site-v2">
      <div className="dagi-ambient" aria-hidden="true"><span /><span /><span /></div>
      <header className="dagi-nav dagi-nav-v2">
        <Link className="dagi-brand" href={`/${lang}`} aria-label="Dagi Spa home">
          <img src="/dagi/logo.jpg" alt="Dagi Spa" />
          <span>Dagi Spa<small>Discover Peace</small></span>
        </Link>
        <nav aria-label="Dagi Spa navigation">
          <a href="#home">{lang === "am" ? "መነሻ" : "Home"}</a>
          {t.nav.map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}
        </nav>
        <div className="dagi-nav-actions">
          <Link href={lang === "en" ? "/am" : "/en"}>{lang === "en" ? "አማ" : "EN"}</Link>
        </div>
      </header>

      <section className="dagi-hero dagi-hero-v2" id="home">
        <div className="dagi-hero-copy">
          <p>{t.heroKicker}</p>
          <h1>{t.heroTitle}</h1>
          <span>{t.heroBody}</span>
          <div className="dagi-hero-actions">
            <a href="#booking">{t.heroCta}</a>
            <a className="dagi-ghost-link" href="#treatments">{t.secondaryCta}</a>
          </div>
          <div className="dagi-hero-metrics" aria-label="Dagi Spa highlights">
            <strong><span>2009</span>Since</strong>
            <strong><span>2</span>Branches</strong>
            <strong><span>12/7</span>Open</strong>
          </div>
        </div>

        <aside className="dagi-3d-stage" aria-label="Dagi Spa featured experience">
          <div className="dagi-orbit" aria-hidden="true"><span /><span /><span /></div>
          <article className="dagi-hero-card" onMouseMove={handleTilt} onMouseLeave={resetTilt}>
            <div className="dagi-hero-card-glow" />
            <img src="/dagi/massage.jpg" alt="Dagi Spa massage treatment" />
            <div className="dagi-card-caption">
              <small>Signature ritual</small>
              <strong>Massage • Moroccan Bath • Facial</strong>
            </div>
          </article>
          <div className="dagi-floating-card one"><span>★★★★★</span>Guest-loved calm</div>
          <div className="dagi-floating-card two">+251912923692</div>
          <div className="dagi-floating-card three">Yoly Hotel · Alfoz Plaza</div>
        </aside>
      </section>

      <section className="dagi-ritual-marquee" aria-label="Dagi Spa services">
        <div>{[...rituals, ...rituals].map((ritual, index) => <span key={`${ritual}-${index}`}>{ritual}</span>)}</div>
      </section>

      <section className="dagi-section dagi-about dagi-about-v2" id="about">
        <div className="dagi-logo-sculpture" onMouseMove={handleTilt} onMouseLeave={resetTilt}>
          <img src="/dagi/logo-white.png" alt="Dagi Spa mark" />
          <span aria-hidden="true" />
        </div>
        <article>
          <p>{t.heroKicker}</p>
          <h2>{t.aboutTitle}</h2>
          <span>{t.aboutBody}</span>
          <div className="dagi-feature-grid">
            <strong>Comprehensive treatments</strong>
            <strong>Exceptional Moroccan bath</strong>
            <strong>Warm professional staff</strong>
            <strong>High cleanliness standard</strong>
          </div>
        </article>
      </section>

      <section className="dagi-section dagi-treatments-v2" id="treatments">
        <p className="dagi-eyebrow">Our Treatments</p>
        <h2>{t.treatmentsTitle}</h2>
        <div className="dagi-card-grid">
          {treatments.map((treatment) => (
            <article className="dagi-treatment-card dagi-treatment-card-v2" key={treatment.title} onMouseMove={handleTilt} onMouseLeave={resetTilt}>
              <img src={treatment.image} alt={treatment.title} />
              <div className="dagi-treatment-icon">{treatment.icon}</div>
              <div><h3>{lang === "am" ? treatment.am : treatment.title}</h3><p>{treatment.body}</p><a href="#booking">Book now</a></div>
            </article>
          ))}
        </div>
      </section>

      <section className="dagi-section dagi-treatment-details" aria-label="Detailed treatments">
        <p className="dagi-eyebrow">Detailed Treatments</p>
        <h2>{lang === "am" ? "እያንዳንዱን አገልግሎት በዝርዝር" : "Choose the ritual that fits your day"}</h2>
        <div className="dagi-treatment-detail-grid">
          {detailedTreatments.map((item) => (
            <article key={item.title} className="dagi-treatment-detail-card" onMouseMove={handleTilt} onMouseLeave={resetTilt}>
              <img src={item.image} alt={`${item.title} at Dagi Spa`} />
              <div>
                <span>{item.duration}</span>
                <h3>{lang === "am" ? item.am : item.title}</h3>
                <ul>{item.details.map((detail) => <li key={detail}><i className="bi bi-check2-circle" />{detail}</li>)}</ul>
                <a href="#booking">{lang === "am" ? "ይህን ይመርጡ" : "Select this treatment"}</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dagi-section dagi-gallery" id="gallery">
        <p className="dagi-eyebrow">Gallery</p>
        <h2>{lang === "am" ? "የDagi Spa ጋለሪ" : "A glimpse of the Dagi Spa atmosphere"}</h2>
        <div className="dagi-gallery-grid">
          {gallery.map((item, index) => (
            <figure
              key={`${item.title}-${index}`}
              className={index === 0 ? "featured" : ""}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedGallery(item)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedGallery(item); }}
            >
              <img src={item.image} alt={item.title} />
              <figcaption><i className="bi bi-stars" />{item.title}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {selectedGallery && (
        <div className="dagi-gallery-lightbox" role="dialog" aria-modal="true" aria-label={selectedGallery.title} onClick={() => setSelectedGallery(null)}>
          <button type="button" aria-label="Close gallery image" onClick={() => setSelectedGallery(null)}><i className="bi bi-x-lg" /></button>
          <figure onClick={(event) => event.stopPropagation()}>
            <img src={selectedGallery.image} alt={selectedGallery.title} />
            <figcaption>{selectedGallery.title}</figcaption>
          </figure>
        </div>
      )}

      <section className="dagi-section dagi-branches dagi-branches-v2" id="branches">
        <p className="dagi-eyebrow">Two branches open to serve you better</p>
        <h2>{t.branchesTitle}</h2>
        <div className="dagi-card-grid two">
          {branches.map((branch, index) => (
            <article key={branch.title} className="dagi-branch-card dagi-branch-card-v2" onMouseMove={handleTilt} onMouseLeave={resetTilt}>
              <img src={branch.image} alt={`${branch.title} Dagi Spa branch`} />
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{branch.title}</h3>
              <p>{branch.detail}</p>
              <a href={`tel:+251${branch.phone.replace(/\D/g, "").slice(1, 10)}`}>{branch.phone}</a>
            </article>
          ))}
        </div>
      </section>

      <section className="dagi-section dagi-map-section" id="map">
        <div className="dagi-map-heading">
          <p className="dagi-eyebrow">Find Us</p>
          <h2>{lang === "am" ? "በካርታ ላይ ቅርንጫፎቻችንን ያግኙ" : "Find your nearest Dagi Spa branch"}</h2>
        </div>
        <div className="dagi-map-grid">
          {branches.map((branch) => (
            <article key={`${branch.title}-map`} className="dagi-map-card">
              <div>
                <img src={branch.image} alt={`${branch.title} icon`} />
                <span>{branch.title}</span>
                <strong>{branch.detail}</strong>
                <a href={`tel:+251${branch.phone.replace(/\D/g, "").slice(1, 10)}`}><i className="bi bi-telephone-fill" />{branch.phone}</a>
              </div>
              <iframe title={`${branch.title} map`} src={branch.map} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </article>
          ))}
        </div>
      </section>

      <section className="dagi-section dagi-reviews dagi-reviews-v2" id="reviews">
        <p className="dagi-eyebrow">Customer Reviews</p>
        <h2>{t.reviewsTitle}</h2>
        <div className="dagi-card-grid three">
          {reviews.map((review) => <article key={review} onMouseMove={handleTilt} onMouseLeave={resetTilt}><strong>★★★★★</strong><p>“{review}”</p></article>)}
        </div>
      </section>

      <section className="dagi-section dagi-gift dagi-gift-v2" id="gift-cards">
        <div><p className="dagi-eyebrow">Gift Cards</p><h2>{t.giftTitle}</h2><span>{t.giftBody}</span></div>
        <a href="tel:+251912923692">Call to buy</a>
      </section>

      <section className="dagi-section dagi-booking dagi-booking-v2" id="booking">
        <article>
          <p className="dagi-eyebrow">Book Now</p>
          <h2>{t.bookingTitle}</h2>
          <span>{t.bookingBody}</span>
          <div className="dagi-confirmation-note"><b>No auto-payment.</b><br />Staff confirms each request personally.</div>
        </article>
        <form onSubmit={submit}>
          {message && <div className="dagi-form-message success">{message}</div>}
          {error && <div className="dagi-form-message error">{error}</div>}
          <label><span>{t.fields.full_name}</span><input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
          <label><span>{t.fields.phone}</span><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label><span>{t.fields.email}</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label><span>{lang === "am" ? "ማረጋገጫ መቀበያ" : "Approval notification"}</span><select required value={form.notification_channel} onChange={(e) => setForm({ ...form, notification_channel: e.target.value })}><option value="whatsapp">WhatsApp</option><option value="telegram">Telegram</option><option value="sms">SMS</option><option value="email">Email</option><option value="phone">Phone call</option></select></label>
          <label><span>{lang === "am" ? "ማረጋገጫ መቀበያ ቁጥር / ዩዘርኔም" : "Approval notification number / username"}</span><input required placeholder={form.notification_channel === "email" ? "you@example.com" : form.notification_channel === "telegram" ? "@username or Telegram chat ID" : "+251 phone number"} value={form.notification_contact} onChange={(e) => setForm({ ...form, notification_contact: e.target.value })} /><small className="dagi-field-help">{lang === "am" ? "የተፈቀደ ቦታዎን ለመላክ የሚጠቀሙበትን ቁጥር፣ ዩዘርኔም ወይም ኢሜይል ያስገቡ።" : "Enter the phone number, Telegram username/chat ID, WhatsApp number, or email that should receive approval."}</small></label>
          <label><span>{t.fields.branch}</span><select required value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}><option value="">Select</option>{branchOptions.map((branch) => <option key={branch}>{branch}</option>)}</select></label>
          <label><span>{t.fields.treatment}</span><select required value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })}><option value="">Select</option>{treatmentOptions.map((treatment) => <option key={treatment}>{treatment}</option>)}</select></label>
          <label><span>{t.fields.preferred_at}</span><input required type="datetime-local" value={form.preferred_at} onChange={(e) => setForm({ ...form, preferred_at: e.target.value })} /></label>
          <label className="full"><span>{t.fields.notes}</span><textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <button type="submit" disabled={saving}>{saving ? "Sending…" : t.submit}</button>
        </form>
      </section>

      <footer className="dagi-footer dagi-footer-v2">
        <img src="/dagi/logo-white.png" alt="Dagi Spa" />
        <p>{t.footer}</p>
        <address>
          <strong>Address List</strong>
          <span>1 - Yoly branch near Bole Atlas, Addis Ababa, Ethiopia 0912923692 / 0917923692</span>
          <span>2 - Alfoz Branch near Bole Imperial, Addis Ababa, Ethiopia 0910888853</span>
          <a href="mailto:dagispainfo@gmail.com">dagispainfo@gmail.com</a>
        </address>
        <div className="dagi-socials dagi-social-icons" aria-label="Social media links">
          <a href="https://www.facebook.com/share/1Lmpiy94b9/" target="_blank" rel="noreferrer" aria-label="Dagi Spa on Facebook"><i className="bi bi-facebook" /><span>Facebook</span></a>
          <a href="https://www.instagram.com/dagi_spa_ethiopia?igsh=dnhkaHdqdnd1NjFs" target="_blank" rel="noreferrer" aria-label="Dagi Spa on Instagram"><i className="bi bi-instagram" /><span>Instagram</span></a>
          <a href="https://www.tiktok.com/@dagi_spa_ethiopia" target="_blank" rel="noreferrer" aria-label="Dagi Spa on TikTok"><i className="bi bi-tiktok" /><span>TikTok</span></a>
          <a href="https://youtube.com/@dagispa?si=uQLGR99Fd16R2yb0" target="_blank" rel="noreferrer" aria-label="Dagi Spa on YouTube"><i className="bi bi-youtube" /><span>YouTube</span></a>
        </div>
      </footer>
    </main>
  );
}
