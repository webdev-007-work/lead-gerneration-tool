const axios = require("axios");
const cheerio = require("cheerio");

// ⏳ Delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ✅ Extract emails (cleaned)
function extractEmails(text) {
  const emailRegex =
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g;

  const matches = text.match(emailRegex) || [];

  return [...new Set(matches)].filter(
    (e) =>
      !e.includes(".png") &&
      !e.includes(".jpg") &&
      !e.includes(".jpeg") &&
      !e.includes(".svg") &&
      !e.includes("example") &&
      !e.includes("test@") &&
      !e.includes("your@") &&
      e.length < 40
  );
}

// ✅ Extract phones
function extractPhones(text) {
  const phoneRegex =
    /(\+91[\-\s]?)?[6-9]\d{9}|\+?\d[\d\s\-]{7,15}/g;

  const matches = text.match(phoneRegex);
  return matches ? [...new Set(matches)][0] : null;
}

// ✅ Detect source
function detectSource(url, source) {
  if (source) return source;

  if (url.includes("facebook.com")) return "facebook";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("justdial.com")) return "justdial";
  if (url.includes("indiamart.com")) return "indiamart";

  return "google";
}

// ❌ Skip bad sites
function isBadSite(url) {
  return (
    url.includes("yelp.com") ||
    url.includes("youtube.com") ||
    url.includes("wikipedia.org") ||
    url.includes("linkedin.com") ||
    url.includes("twitter.com") ||
    url.includes("x.com")
  );
}

// 🔥 MAIN SCRAPER
async function scrape(keyword, source = "google") {
  try {
    let searchQuery = keyword;

    if (source === "facebook") searchQuery += " site:facebook.com";
    if (source === "instagram") searchQuery += " site:instagram.com";
    if (source === "justdial") searchQuery += " site:justdial.com";
    if (source === "indiamart") searchQuery += " site:indiamart.com";

    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

    const { data } = await axios.get(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(data);

    let links = [];
    let leads = [];

    // ✅ Extract links
    $("a.result__a").each((i, el) => {
      let url = $(el).attr("href");

      if (url && url.includes("uddg=")) {
        let cleanUrl = decodeURIComponent(url.split("uddg=")[1]);
        cleanUrl = cleanUrl.split("&")[0];
        links.push(cleanUrl);
      }
    });

    links = [...new Set(links)];
    console.log("🔗 Total links:", links.length);

    // ✅ Visit websites (increased to 10 🚀)
    for (let i = 0; i < Math.min(links.length, 10); i++) {
      await delay(1500);

      try {
        const site = links[i];

        if (!site.startsWith("http") || isBadSite(site)) continue;

        const { data: html } = await axios.get(site, {
          timeout: 10000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          },
        });

        const $$ = cheerio.load(html);

        const title = $$("title").text().trim() || "No title";

        // ✅ EMAIL LOGIC
        let emails = [];

        // 1️⃣ mailto
        $$("a[href^='mailto:']").each((i, el) => {
          const mail = $$(el).attr("href")?.replace("mailto:", "");
          if (mail) emails.push(mail.trim());
        });

        // 2️⃣ FULL HTML SCAN (🔥 IMPORTANT UPGRADE)
        if (emails.length === 0) {
          const text = html.toLowerCase(); // ✅ NEW
          emails = extractEmails(text);
        }

        // 3️⃣ contact/about fallback (improved)
        if (emails.length === 0) {
          for (let path of ["/contact", "/contact-us", "/about", "/about-us"]) {
            try {
              const res = await axios.get(site + path, { timeout: 8000 });
              const found = extractEmails(res.data.toLowerCase());
              if (found.length > 0) {
                emails = found;
                break;
              }
            } catch {}
          }
        }

        const email = emails.length > 0 ? emails[0] : "Not found";
        const phone = extractPhones(html) || "Not found";
        const detectedSource = detectSource(site, source);

        leads.push({
          website: site,
          email,
          phone,
          keyword,
          source: detectedSource,
          title,
        });

      } catch (err) {
        console.log("⚠️ Failed:", links[i]);
      }
    }

    // ✅ REMOVE DUPLICATES
    const uniqueLeads = Array.from(
      new Map(leads.map((l) => [l.website, l])).values()
    );

    console.log("✅ Final leads:", uniqueLeads.length);

    return uniqueLeads;

  } catch (err) {
    console.error("❌ SCRAPER ERROR:", err.message);
    return [];
  }
}

module.exports = scrape;