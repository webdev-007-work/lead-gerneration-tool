require("dotenv").config();

const express = require("express");
const cors = require("cors");

const scrape = require("./scraper");
const supabase = require("./supabase");
const nodemailer = require("nodemailer");

const app = express();


// ✅ 🔥 FINAL CORS (stable version)
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const allowed = [
        "http://localhost:3000",
        "https://frontend-silk-two-63.vercel.app",
      ];

      if (allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // allow all (you can restrict later)
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ JSON
app.use(express.json({ limit: "1mb" }));


// ✅ Logger
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  next();
});


// ⏳ Delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


// ✅ EMAIL TRANSPORTER
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


// ✅ VERIFY EMAIL CONFIG
transporter.verify((error) => {
  if (error) {
    console.log("❌ Email config error:", error.message);
  } else {
    console.log("✅ Email server ready");
  }
});


// ✅ ROOT
app.get("/", (req, res) => {
  res.send("🚀 Lead Generation API is running");
});


// ✅ HEALTH CHECK
app.get("/status", (req, res) => {
  res.json({
    status: "ok",
    emailConfigured: !!process.env.EMAIL_USER,
    time: new Date(),
  });
});


// 🔥 SIMPLE RATE LIMIT (anti-spam)
let lastRequestTime = 0;


// 🔥 SCRAPE + SAVE
app.post("/scrape", async (req, res) => {
  const now = Date.now();

  if (now - lastRequestTime < 5000) {
    return res.status(429).json({ error: "Too many requests. Wait 5 sec." });
  }

  lastRequestTime = now;

  const { keyword, source } = req.body;

  console.log("🔍 Scraping:", keyword, "| Source:", source);

  if (!keyword || keyword.trim() === "") {
    return res.status(400).json({ error: "Keyword is required" });
  }

  try {
    let leads = [];

    try {
      leads = await scrape(keyword, source);
    } catch (err) {
      console.log("❌ Scraper crash:", err.message);
    }

    if (!Array.isArray(leads)) leads = [];

    console.log("📊 Leads fetched:", leads.length);

    if (leads.length === 0) {
      return res.json({ success: true, leads: [] });
    }

    const filteredLeads =
      source && source !== "all"
        ? leads.filter((l) => l.source === source)
        : leads;

    for (let lead of filteredLeads) {
      try {
        const { data: existing } = await supabase
          .from("leads")
          .select("id")
          .eq("website", lead.website)
          .maybeSingle();

        if (existing) {
          console.log("⚠️ Duplicate:", lead.website);
          continue;
        }

        // ✅ CLEAN DATA
        const insertData = {
          business_name: lead.name || "Unknown Business",
        
          email: lead.email || "Not found",
          phone: lead.phone || "Not found",
        
          website: lead.website || "",
        
          instagram_url: lead.instagram || "",
          facebook_url: lead.facebook || "",
        
          city: lead.city || "",
          country: lead.country || "",
        
          industry: keyword,
          keyword: keyword,
        
          source: lead.source || source || "website",
        
          lead_score: 50,
          lead_status: "cold",
          };

        const { error } = await supabase
          .from("leads")
          .insert([insertData]);

        if (error) {
          console.log("❌ DB Error:", error.message);
          continue;
        }

        console.log("✅ Saved:", lead.website);

      } catch (dbErr) {
        console.log("❌ DB Crash:", dbErr.message);
      }
    }

    res.json({
      success: true,
      leads: filteredLeads,
    });

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    res.status(500).json({ error: "Scraping failed" });
  }
});


// ✅ GET LEADS
// ✅ DASHBOARD STATS
app.get("/dashboard-stats", async (req, res) => {
  try {
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*");

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    const stats = {
      totalLeads: leads.length,

      hotLeads: leads.filter(
        (l) => l.lead_status === "hot"
      ).length,

      warmLeads: leads.filter(
        (l) => l.lead_status === "warm"
      ).length,

      coldLeads: leads.filter(
        (l) => l.lead_status === "cold"
      ).length,

      contacted: leads.filter(
        (l) => l.contacted === true
      ).length,

      replied: leads.filter(
        (l) => l.replied === true
      ).length,
    };

    res.json(stats);

  } catch (err) {
    console.log(err.message);

    res.status(500).json({
      error: "Failed to load stats",
    });
  }
});


// ✅ DELETE
app.delete("/leads/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: "Deleted successfully" });

  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});


// app put
    app.put("/leads/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const { data, error } = await supabase
      .from("leads")
      .update({
        lead_status: status,
      })
      .eq("id", id)
      .select();

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    res.json(data);

  } catch (err) {
    res.status(500).json({
      error: "Status update failed",
    });
  }
});


// 📧 SEND EMAILS
app.post("/send-emails", async (req, res) => {
  const { leads } = req.body;

  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: "No leads provided" });
  }

  let success = 0;

  try {
    for (let lead of leads.slice(0, 10)) { // ✅ reduced for safety
      if (lead.email && lead.email !== "Not found") {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: lead.email,
            subject: "Quick question",
            text: `Hi,

I found your website (${lead.website}) and noticed you might not be getting enough leads.

I can help you generate more leads for FREE.

Interested?

– Vivek`,
          });

          success++;
          console.log("✅ Email:", lead.email);

          await delay(3000);

        } catch {
          console.log("❌ Email failed:", lead.email);
        }
      }
    }

    res.json({ message: `✅ Sent ${success} emails` });

  } catch {
    res.status(500).json({ error: "Email process failed" });
  }
});


// 🔁 FOLLOW-UP
app.post("/follow-up", async (req, res) => {
  const { leads } = req.body;

  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: "No leads provided" });
  }

  let success = 0;

  try {
    for (let lead of leads.slice(0, 10)) {
      if (lead.email && lead.email !== "Not found") {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: lead.email,
            subject: "Just following up",
            text: `Hi,

Just checking if you saw my last message.

I can help you get more leads.

Let me know 🙂

– Vivek`,
          });

          success++;
          console.log("📨 Follow-up:", lead.email);

          await delay(3000);

        } catch {
          console.log("❌ Follow-up failed:", lead.email);
        }
      }
    }

    res.json({ message: `🔁 Sent ${success} follow-ups` });

  } catch {
    res.status(500).json({ error: "Follow-up failed" });
  }
});


// 🚀 START SERVER
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


