const axios = require("axios");
const cheerio = require("cheerio");

// ⏳ Delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ✅ Extract emails
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
      !e.includes("?") &&
      !e.includes("noreply") &&
      !e.includes("no-reply") &&
      e.length < 45
  );
}

// ✅ Extract phones
function extractPhones(text) {
  const phoneRegex =
    /(\+91[\-\s]?)?[6-9]\d{9}/g;

  const matches = text.match(phoneRegex);

  if (!matches) return null;

  const cleaned = matches.map((num) =>
    num.replace(/\D/g, "").slice(-10)
  );

  const unique = [...new Set(cleaned)];

  return unique[0] || null;
}

// ✅ Detect source
function detectSource(url, source) {
  if (source && source !== "google")
    return source;

  if (url.includes("facebook.com"))
    return "facebook";

  if (url.includes("instagram.com"))
    return "instagram";

  if (url.includes("justdial.com"))
    return "justdial";

  if (url.includes("indiamart.com"))
    return "indiamart";

  return "google";
}

// ❌ Skip bad websites
function isBadSite(url) {
  const blocked = [
    "youtube.com",
    "facebook.com/login",
    "linkedin.com",
    "twitter.com",
    "x.com",
    "wikipedia.org",
    "yelp.com",
    "quora.com",
    "reddit.com",
    "glassdoor.com",
  ];

  return blocked.some((site) =>
    url.includes(site)
  );
}

// 🔥 MAIN SCRAPER
async function scrape(keyword, source = "google") {
  try {
    let searchQuery = keyword;

    // Source targeting
    if (source === "facebook")
      searchQuery += " site:facebook.com";

    if (source === "instagram")
      searchQuery += " site:instagram.com";

    if (source === "justdial")
      searchQuery += " site:justdial.com";

    if (source === "indiamart")
      searchQuery += " site:indiamart.com";

    const searchUrl =
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

    // ✅ DuckDuckGo Search
    const { data } = await axios.get(
      searchUrl,
      {
        timeout: 15000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "text/html",
        },
      }
    );

    const $ = cheerio.load(data);

    let links = [];
    let leads = [];

    // Extract links
    $("a.result__a").each((i, el) => {
      let url = $(el).attr("href");

      if (url && url.includes("uddg=")) {
        let cleanUrl = decodeURIComponent(
          url.split("uddg=")[1]
        );

        cleanUrl = cleanUrl.split("&")[0];

        if (
          cleanUrl.startsWith("http")
        ) {
          links.push(cleanUrl);
        }
      }
    });

    links = [...new Set(links)];

    console.log(
      "🔗 Total links:",
      links.length
    );

    // Visit max 10 websites
    for (
      let i = 0;
      i < Math.min(links.length, 10);
      i++
    ) {
      const site = links[i];

      await delay(2000);

      try {
        if (
          !site ||
          !site.startsWith("http") ||
          isBadSite(site)
        ) {
          continue;
        }

        console.log(
          "🔍 Scraping:",
          site
        );

        // Retry system
        let html = "";

        for (
          let retry = 0;
          retry < 2;
          retry++
        ) {
          try {
            const response =
              await axios.get(site, {
                timeout: 15000,
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                  Accept:
                    "text/html",
                },
              });

            html =
              response.data;

            break;
          } catch (err) {
            console.log(
              "⚠️ Retrying:",
              site
            );

            await delay(3000);
          }
        }

        if (!html) continue;

        const $$ =
          cheerio.load(html);

        const title =
          $$("title")
            .text()
            .trim() ||
          "No title";

        const text =
          html.toLowerCase();

        // ========= EMAIL =========
        let emails = [];

        // mailto
        $$(
          "a[href^='mailto:']"
        ).each((i, el) => {
          let mail =
            $$(el)
              .attr("href")
              ?.replace(
                "mailto:",
                ""
              );

          if (mail) {
            mail =
              mail
                .split("?")[0]
                .trim();

            if (
              mail.includes("@")
            ) {
              emails.push(
                mail
              );
            }
          }
        });

        // Full page scan
        if (emails.length === 0) {
          emails =
            extractEmails(
              text
            );
        }

        // Contact page scan
        if (emails.length === 0) {
          const pages = [
            "/contact",
            "/contact-us",
            "/about",
            "/about-us",
          ];

          for (const path of pages) {
            try {
              const res =
                await axios.get(
                  site + path,
                  {
                    timeout: 8000,
                  }
                );

              const found =
                extractEmails(
                  res.data.toLowerCase()
                );

              if (
                found.length > 0
              ) {
                emails =
                  found;
                break;
              }
            } catch {}
          }
        }

        const email =
          emails[0] ||
          "Not found";

        // ========= PHONE =========
        const phone =
          extractPhones(
            text
          ) ||
          "Not found";

        // ========= SAVE =========
        leads.push({
          website: site,
          email,
          phone,
          keyword,
          source:
            detectSource(
              site,
              source
            ),
          title,
        });

        console.log(
          "✅ Lead Found:",
          site
        );

      } catch (err) {
        console.log(
          "❌ Failed:",
          site
        );
      }
    }

    // Remove duplicates
    const uniqueLeads =
      Array.from(
        new Map(
          leads.map((l) => [
            l.website,
            l,
          ])
        ).values()
      );

    console.log(
      "✅ Final leads:",
      uniqueLeads.length
    );

    return uniqueLeads;

  } catch (err) {
    console.error(
      "❌ SCRAPER ERROR:",
      err.message
    );

    return [];
  }
}

module.exports = scrape;