require("dotenv").config();

const express = require("express");
const cors = require("cors");

const scrape = require("./scraper");
const supabase = require("./supabase");
const nodemailer = require("nodemailer");

const app = express();


// ✅ 🔥 CORS FIX (IMPORTANT)
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://lead-generation-tool.vercel.app"
    ],
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

// ✅ JSON FIX
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
  res.send("API running...");
});


// ✅ HEALTH CHECK
app.get("/status", (req, res) => {
  res.json({
    status: "ok",
    emailConfigured: !!process.env.EMAIL_USER,
  });
});


// 🔥 SCRAPE + SAVE
app.post("/scrape", async (req, res) => {
  const { keyword, source } = req.body;

  console.log("🔍 Scraping:", keyword, "| Source:", source);

  if (!keyword || keyword.trim() === "") {
    return res.status(400).json({ error: "Keyword is required" });
  }

  try {
    let leads = await scrape(keyword, source);

    if (!Array.isArray(leads)) leads = [];

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

        const insertData = {
          website: lead.website,
          email: lead.email,
          phone: lead.phone,
          keyword: keyword,
        };

        if (lead.source) {
          insertData.source = lead.source;
        }

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
app.get("/leads", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leads" });
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


// 📧 SEND EMAILS
app.post("/send-emails", async (req, res) => {
  const { leads } = req.body;

  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: "No leads provided" });
  }

  let success = 0;

  try {
    for (let lead of leads.slice(0, 20)) {
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
    for (let lead of leads.slice(0, 20)) {
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