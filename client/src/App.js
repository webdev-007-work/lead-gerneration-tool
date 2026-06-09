import { useState, useEffect } from "react";

const BASE_URL = "http://localhost:5000";

function App() {
  const [keyword, setKeyword] = useState("");
  const [leads, setLeads] = useState([]);
  const [sessionLeads, setSessionLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [visibleCount, setVisibleCount] = useState(5);
  const [sourceFilter, setSourceFilter] =
    useState("all");

  const [source, setSource] =
    useState("google");

  const [stats, setStats] = useState({
    totalLeads: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
    contacted: 0,
    replied: 0,
  });

  useEffect(() => {
    fetchLeads();
    fetchDashboardStats();
  }, []);

  // FETCH LEADS
  const fetchLeads = async () => {
    try {
      const res = await fetch(
        `${BASE_URL}/leads`
      );

      const data = await res.json();

      setLeads(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (err) {
      console.error(
        "Fetch error:",
        err
      );
    }
  };

  // DASHBOARD STATS
  const fetchDashboardStats =
    async () => {
      try {
        const res = await fetch(
          `${BASE_URL}/dashboard-stats`
        );

        const data =
          await res.json();

        setStats(data);
      } catch (err) {
        console.error(
          "Dashboard error:",
          err
        );
      }
    };

  // DELETE LEAD
  const deleteLead = async (
    id
  ) => {
    if (
      !window.confirm(
        "Delete this lead?"
      )
    )
      return;

    await fetch(
      `${BASE_URL}/leads/${id}`,
      {
        method: "DELETE",
      }
    );

    fetchLeads();
    fetchDashboardStats();
  };

  // SEARCH
  const handleSearch =
    async () => {
      if (!keyword)
        return alert(
          "Enter keyword"
        );

      setLoading(true);
      setVisibleCount(5);

      try {
        const res = await fetch(
          `${BASE_URL}/scrape`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              {
                keyword,
                source,
              }
            ),
          }
        );

        const data =
          await res.json();

        const leadsData =
          Array.isArray(
            data.leads
          )
            ? data.leads
            : [];

        setLeads(leadsData);
        setSessionLeads(
          leadsData
        );

        fetchDashboardStats();
      } catch (err) {
        console.error(err);
        setLeads([]);
      }

      setLoading(false);
    };

  // EXPORT CSV
  const exportCSV = () => {
    const headers = [
      "Website",
      "Email",
      "Phone",
      "Keyword",
      "Source",
    ];

    const rows = leads.map(
      (lead) => [
        lead.website,
        lead.email,
        lead.phone,
        lead.keyword,
        lead.source ||
          "google",
      ]
    );

    const csv =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows]
        .map((e) =>
          e.join(",")
        )
        .join("\n");

    const link =
      document.createElement(
        "a"
      );

    link.href =
      encodeURI(csv);

    link.download =
      "leads.csv";

    link.click();
  };

  // SEND EMAILS
  const sendEmails =
    async () => {
      const valid =
        leads.filter(
          (l) =>
            l.email &&
            l.email !==
              "Not found"
        );

      if (
        valid.length === 0
      )
        return alert(
          "No emails found"
        );

      await fetch(
        `${BASE_URL}/send-emails`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            {
              leads: valid,
            }
          ),
        }
      );

      alert(
        `Sent ${valid.length} emails`
      );
    };

  // FOLLOW UP
  const sendFollowUp =
    async () => {
      const valid =
        leads.filter(
          (l) =>
            l.email &&
            l.email !==
              "Not found"
        );

      if (
        valid.length === 0
      )
        return alert(
          "No emails found"
        );

      await fetch(
        `${BASE_URL}/follow-up`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            {
              leads: valid,
            }
          ),
        }
      );

      alert(
        "Follow-up sent"
      );
    };

  // STATUS
  const getStatus = (
    lead
  ) => {
    if (
      lead.email !==
        "Not found" &&
      lead.phone !==
        "Not found"
    )
      return "hot";

    if (
      lead.email !==
      "Not found"
    )
      return "warm";

    return "cold";
  };

  // FILTER
  const filteredLeads =
    leads.filter((lead) => {
      return (
        (sourceFilter ===
          "all" ||
          lead.source ===
            sourceFilter) &&
        (
          lead.website ||
          ""
        )
          .toLowerCase()
          .includes(
            filter.toLowerCase()
          )
      );
    });

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* SIDEBAR */}
      <div className="w-60 bg-white shadow-md p-4">
        <h2 className="text-xl font-bold mb-6">
          🚀 Lead Tool
        </h2>

        <ul className="space-y-3">
          <li className="text-blue-600 font-semibold">
            Dashboard
          </li>
          <li>Leads</li>
          <li>Campaigns</li>
          <li>Workflows</li>
        </ul>
      </div>

      {/* MAIN */}
      <div className="flex-1 p-6">
        {/* HEADER */}
        <div className="flex justify-between mb-6">
          <h1 className="text-3xl font-bold">
            Smart Workflow
            Automation
          </h1>

          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
            Upgrade
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow">
            <p>Total Leads</p>
            <h2 className="text-2xl font-bold">
              {
                stats.totalLeads
              }
            </h2>
          </div>

          <div className="bg-green-100 p-4 rounded-xl shadow">
            <p>🔥 Hot</p>
            <h2 className="text-2xl font-bold">
              {stats.hotLeads}
            </h2>
          </div>

          <div className="bg-yellow-100 p-4 rounded-xl shadow">
            <p>🟡 Warm</p>
            <h2 className="text-2xl font-bold">
              {
                stats.warmLeads
              }
            </h2>
          </div>

          <div className="bg-red-100 p-4 rounded-xl shadow">
            <p>❄️ Cold</p>
            <h2 className="text-2xl font-bold">
              {
                stats.coldLeads
              }
            </h2>
          </div>

          <div className="bg-blue-100 p-4 rounded-xl shadow">
            <p>
              📨 Contacted
            </p>
            <h2 className="text-2xl font-bold">
              {
                stats.contacted
              }
            </h2>
          </div>

          <div className="bg-purple-100 p-4 rounded-xl shadow">
            <p>✅ Replied</p>
            <h2 className="text-2xl font-bold">
              {stats.replied}
            </h2>
          </div>
        </div>

        {/* SEARCH */}
        <div className="bg-white p-4 rounded-xl shadow mb-4 flex gap-2">
          <input
            className="flex-1 border p-2 rounded-lg"
            placeholder="Enter keyword..."
            value={keyword}
            onChange={(e) =>
              setKeyword(
                e.target.value
              )
            }
          />

          <select
            value={source}
            onChange={(e) =>
              setSource(
                e.target.value
              )
            }
            className="border p-2 rounded-lg"
          >
            <option value="google">
              Google
            </option>
            <option value="facebook">
              Facebook
            </option>
            <option value="instagram">
              Instagram
            </option>
            <option value="justdial">
              Justdial
            </option>
            <option value="indiamart">
              IndiaMart
            </option>
          </select>

          <button
            onClick={
              handleSearch
            }
            className="bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            {loading
              ? "⏳ Searching..."
              : "Search"}
          </button>
        </div>

        {/* FILTER */}
        <input
          type="text"
          placeholder="Filter leads..."
          className="w-full border p-2 rounded-lg mb-4"
          value={filter}
          onChange={(e) =>
            setFilter(
              e.target.value
            )
          }
        />

        {/* SOURCE FILTER */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            "all",
            "google",
            "facebook",
            "instagram",
            "justdial",
            "indiamart",
          ].map((src) => (
            <button
              key={src}
              onClick={() =>
                setSourceFilter(
                  src
                )
              }
              className={`px-3 py-1 rounded-full ${
                sourceFilter ===
                src
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200"
              }`}
            >
              {src}
            </button>
          ))}
        </div>

        {/* ACTIONS */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={exportCSV}
            className="bg-gray-300 px-4 py-2 rounded-lg"
          >
            📄 Export
          </button>

          <button
            onClick={
              sendEmails
            }
            className="bg-green-600 text-white px-4 py-2 rounded-lg"
          >
            📧 Emails
          </button>

          <button
            onClick={
              sendFollowUp
            }
            className="bg-yellow-500 text-white px-4 py-2 rounded-lg"
          >
            🔁 Follow-up
          </button>
        </div>

        {/* LEADS LIST */}
        <div className="space-y-4">
          {filteredLeads
            .slice(
              0,
              visibleCount
            )
            .map(
              (
                lead,
                index
              ) => (
                <div
                  key={
                    index
                  }
                  className="bg-white p-4 rounded-xl shadow flex justify-between items-center"
                >
                  <div>
                    <h3 className="font-bold text-lg">
                      {
                        lead.title
                      }
                    </h3>

                    <p className="text-sm text-gray-600">
                      🌐{" "}
                      {
                        lead.website
                      }
                    </p>

                    <p className="text-sm">
                      📧{" "}
                      {
                        lead.email
                      }
                    </p>

                    <p className="text-sm">
                      📞{" "}
                      {
                        lead.phone
                      }
                    </p>

                    <span className="text-xs bg-blue-100 px-2 py-1 rounded mt-2 inline-block">
                      {
                        lead.source
                      }
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={
                        lead.website
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      <button className="bg-blue-600 text-white px-3 py-1 rounded">
                        Visit
                      </button>
                    </a>

                    <button
                      onClick={() =>
                        deleteLead(
                          lead.id
                        )
                      }
                      className="bg-red-500 text-white px-3 py-1 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            )}
        </div>

        {/* LOAD MORE */}
        {visibleCount <
          filteredLeads.length && (
          <button
            onClick={() =>
              setVisibleCount(
                visibleCount +
                  5
              )
            }
            className="mt-6 bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Load More
          </button>
        )}
      </div>
    </div>
  );
}

export default App;

// Update deployment