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
};

const content = {
  en: {
    nav: ["About", "Treatments", "Branches", "Reviews", "Gift Cards", "Booking"],
    staff: "Staff Portal",
    heroKicker: "Welcome to Dagi Spa",
    heroTitle: "Relax. Rejuvenate. Repeat.",
    heroBody: "Unwind in our tranquil Addis Ababa sanctuary with expertly crafted treatments designed to calm your body and clear your mind.",
    heroCta: "Book a visit",
    aboutTitle: "Your Sanctuary of Luxury, Wellness, and Renewal",
    aboutBody: "Since 2009, Dagi Spa has been a haven for true relaxation, radiant skin, and total rejuvenation. Our professional team combines expertise with genuine warmth so every visit leaves you refreshed, restored, and renewed.",
    call: "Call Anytime",
    treatmentsTitle: "What We’re Offering",
    branchesTitle: "Our Branches",
    reviewsTitle: "What Guests Say About Dagi Spa",
    giftTitle: "Give the gift of relaxation.",
    giftBody: "Treat loved ones to a rejuvenating Dagi Spa gift card — perfect for any occasion. To purchase locally, call us.",
    bookingTitle: "Request a booking",
    bookingBody: "Public requests require staff confirmation. No appointment or payment is created automatically.",
    submit: "Send request",
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
    nav: ["ስለ እኛ", "አገልግሎቶች", "ቅርንጫፎች", "አስተያየቶች", "የስጦታ ካርድ", "ቦታ ማስያዝ"],
    staff: "የሰራተኞች መግቢያ",
    heroKicker: "እንኳን ወደ Dagi Spa በደህና መጡ",
    heroTitle: "ዘና ይበሉ። ይታደሱ። ይድገሙ።",
    heroBody: "በአዲስ አበባ ውስጥ በሚገኘው የሰላም ስፍራችን ሰውነትዎን ለማረጋጋትና አእምሮዎን ለማደስ የተዘጋጁ የስፓ አገልግሎቶችን ይሞክሩ።",
    heroCta: "ቦታ ያስይዙ",
    aboutTitle: "የቅንጦት፣ የጤና እና የእድሳት መዳረሻዎ",
    aboutBody: "ከ2009 ጀምሮ Dagi Spa ለእውነተኛ እረፍት፣ ለብሩህ ቆዳ እና ለሙሉ እድሳት የሚመረጥ ቦታ ነው። ባለሙያ ቡድናችን በሙቀትና በትኩረት ያገለግላል።",
    call: "በማንኛውም ጊዜ ይደውሉ",
    treatmentsTitle: "የምናቀርባቸው አገልግሎቶች",
    branchesTitle: "ቅርንጫፎቻችን",
    reviewsTitle: "ደንበኞች ስለ Dagi Spa የሚሉት",
    giftTitle: "የእረፍት ስጦታ ይስጡ።",
    giftBody: "ለወዳጅ ዘመዶችዎ ለማንኛውም አጋጣሚ የሚሆን የDagi Spa የስጦታ ካርድ ይግዙ። በአካባቢ ለመግዛት ይደውሉ።",
    bookingTitle: "የቦታ ማስያዝ ጥያቄ",
    bookingBody: "የድር ጥያቄዎች በሰራተኞች መረጋገጥ ያስፈልጋቸዋል። ቀጠሮ ወይም ክፍያ በራስ-ሰር አይፈጠርም።",
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
  { title: "Moroccan Bath", am: "ሞሮካን ባዝ", body: "Cleanse, exfoliate, and leave your skin glowing.", image: "/dagi/moroccan-bath.jpg" },
  { title: "Massages", am: "ማሳጅ", body: "Customized massage that soothes muscles and tension.", image: "/dagi/massage.jpg" },
  { title: "Reflexology", am: "ሪፍሌክሶሎጂ", body: "Targeted foot therapy to relieve stress and restore balance.", image: "/dagi/moroccan-bath.jpg" },
];

const branches = [
  { title: "Yoly Hotel", detail: "Near Bole Atlas, Addis Ababa · 0912923692 / 0917923692", image: "/dagi/yoly.png" },
  { title: "Alfoz Plaza", detail: "Near Bole Imperial, Addis Ababa · 0910888853", image: "/dagi/alfo.png" },
];

const reviews = [
  "The Moroccan bath was beyond relaxing, and the staff’s attention to detail made all the difference.",
  "The hot stone massage is a must-try. Skilled therapists and outstanding customer service.",
  "Facilities are top-notch, professional, and welcoming from the moment you walk in.",
];

const initialForm: BookingForm = { full_name: "", phone: "", email: "", branch: "", treatment: "", preferred_at: "", notes: "" };

export default function DagiLandingPage({ locale }: { locale: string }) {
  const lang: Locale = locale === "am" ? "am" : "en";
  const t = content[lang];
  const [form, setForm] = useState<BookingForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const direction = lang === "am" ? "ltr" : "ltr";

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
    <main className="dagi-site" dir={direction}>
      <header className="dagi-nav">
        <Link className="dagi-brand" href={`/${lang}`} aria-label="Dagi Spa home">
          <img src="/dagi/logo.jpg" alt="Dagi Spa" />
          <span>Dagi Spa</span>
        </Link>
        <nav aria-label="Dagi Spa navigation">
          {t.nav.map((item) => <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`}>{item}</a>)}
        </nav>
        <div className="dagi-nav-actions">
          <Link href={lang === "en" ? "/am" : "/en"}>{lang === "en" ? "አማ" : "EN"}</Link>
          <Link className="dagi-staff" href="/login">{t.staff}</Link>
        </div>
      </header>

      <section className="dagi-hero" id="home">
        <div className="dagi-hero-copy">
          <p>{t.heroKicker}</p>
          <h1>{t.heroTitle}</h1>
          <span>{t.heroBody}</span>
          <div className="dagi-hero-actions">
            <a href="#booking">{t.heroCta}</a>
            <strong>{t.call}: +251912923692 / +251910888853</strong>
          </div>
        </div>
        <div className="dagi-hero-image"><img src="/dagi/massage.jpg" alt="Dagi Spa treatment room" /></div>
      </section>

      <section className="dagi-section dagi-about" id={t.nav[0].toLowerCase().replaceAll(" ", "-")}>
        <div><img src="/dagi/logo-white.png" alt="Dagi Spa mark" /></div>
        <article>
          <p>{t.heroKicker}</p>
          <h2>{t.aboutTitle}</h2>
          <span>{t.aboutBody}</span>
          <ul>
            <li>Comprehensive Treatment Options</li>
            <li>Exceptional Moroccan Bath Experience</li>
            <li>Warm and Professional Staff</li>
            <li>High Standard of Cleanliness</li>
          </ul>
        </article>
      </section>

      <section className="dagi-section" id={t.nav[1].toLowerCase().replaceAll(" ", "-")}>
        <p className="dagi-eyebrow">Our Treatments</p>
        <h2>{t.treatmentsTitle}</h2>
        <div className="dagi-card-grid">
          {treatments.map((treatment) => (
            <article className="dagi-treatment-card" key={treatment.title}>
              <img src={treatment.image} alt={treatment.title} />
              <div><h3>{lang === "am" ? treatment.am : treatment.title}</h3><p>{treatment.body}</p><a href="#booking">Book now</a></div>
            </article>
          ))}
        </div>
      </section>

      <section className="dagi-section dagi-branches" id={t.nav[2].toLowerCase().replaceAll(" ", "-")}>
        <p className="dagi-eyebrow">Two branches open to serve you better</p>
        <h2>{t.branchesTitle}</h2>
        <div className="dagi-card-grid two">
          {branches.map((branch, index) => (
            <article key={branch.title} className="dagi-branch-card">
              <img src={branch.image} alt={`${branch.title} Dagi Spa branch`} />
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{branch.title}</h3>
              <p>{branch.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dagi-section dagi-reviews" id={t.nav[3].toLowerCase().replaceAll(" ", "-")}>
        <p className="dagi-eyebrow">Customer Reviews</p>
        <h2>{t.reviewsTitle}</h2>
        <div className="dagi-card-grid three">
          {reviews.map((review) => <article key={review}><strong>★★★★★</strong><p>“{review}”</p></article>)}
        </div>
      </section>

      <section className="dagi-section dagi-gift" id={t.nav[4].toLowerCase().replaceAll(" ", "-")}>
        <div><h2>{t.giftTitle}</h2><p>{t.giftBody}</p></div>
        <a href="tel:+251912923692">+251912923692</a>
      </section>

      <section className="dagi-section dagi-booking" id="booking">
        <article>
          <p className="dagi-eyebrow">Book Now</p>
          <h2>{t.bookingTitle}</h2>
          <span>{t.bookingBody}</span>
        </article>
        <form onSubmit={submit}>
          {message && <div className="dagi-form-message success">{message}</div>}
          {error && <div className="dagi-form-message error">{error}</div>}
          <label><span>{t.fields.full_name}</span><input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
          <label><span>{t.fields.phone}</span><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label><span>{t.fields.email}</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label><span>{t.fields.branch}</span><select required value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}><option value="">Select</option>{branchOptions.map((branch) => <option key={branch}>{branch}</option>)}</select></label>
          <label><span>{t.fields.treatment}</span><select required value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })}><option value="">Select</option>{treatmentOptions.map((treatment) => <option key={treatment}>{treatment}</option>)}</select></label>
          <label><span>{t.fields.preferred_at}</span><input required type="datetime-local" value={form.preferred_at} onChange={(e) => setForm({ ...form, preferred_at: e.target.value })} /></label>
          <label className="full"><span>{t.fields.notes}</span><textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <button type="submit" disabled={saving}>{saving ? "Sending…" : t.submit}</button>
        </form>
      </section>

      <footer className="dagi-footer">
        <img src="/dagi/logo-white.png" alt="Dagi Spa" />
        <p>{t.footer}</p>
        <address>
          <strong>Address List</strong>
          <span>1 - Yoly branch near Bole Atlas, Addis Ababa, Ethiopia 0912923692 / 0917923692</span>
          <span>2 - Alfoz Branch near Bole Imperial, Addis Ababa, Ethiopia 0910888853</span>
          <a href="mailto:dagispainfo@gmail.com">dagispainfo@gmail.com</a>
        </address>
        <div className="dagi-socials" aria-label="Social media links">
          <a href="https://www.facebook.com/share/1Lmpiy94b9/" target="_blank" rel="noreferrer">Facebook</a>
          <a href="https://www.instagram.com/dagi_spa_ethiopia?igsh=dnhkaHdqdnd1NjFs" target="_blank" rel="noreferrer">Instagram</a>
          <a href="https://www.tiktok.com/@dagi_spa_ethiopia" target="_blank" rel="noreferrer">TikTok</a>
          <a href="https://youtube.com/@dagispa?si=uQLGR99Fd16R2yb0" target="_blank" rel="noreferrer">YouTube</a>
        </div>
      </footer>
    </main>
  );
}
