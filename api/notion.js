export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const token = process.env.NOTION_TOKEN;
    const dbId = (process.env.NOTION_DB_ID || "").replace(/-/g, "");
    const dateProp = process.env.NOTION_DATE_PROP || "Date";
    const typeProp = process.env.NOTION_TYPE_PROP || "Type";
    const statusProp = process.env.NOTION_STATUS_PROP || "Status";
    const doneValue = process.env.NOTION_DONE_VALUE || "Done";

    if (!token || !dbId) {
      return res.status(500).json({
        error: "Missing NOTION_TOKEN or NOTION_DB_ID in environment variables",
      });
    }

    const notionUrl = `https://api.notion.com/v1/databases/${dbId}/query`;

    let allResults = [];
    let hasMore = true;
    let cursor = undefined;

    while (hasMore) {
      const body = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;

      const notionRes = await fetch(notionUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!notionRes.ok) {
        const text = await notionRes.text();
        return res.status(notionRes.status).json({
          error: "Notion API error",
          detail: text.slice(0, 300),
        });
      }

      const data = await notionRes.json();
      allResults = allResults.concat(data.results || []);
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    const entries = allResults
      .map((page) => {
        const props = page.properties || {};

        const dateP = props[dateProp] || {};
        const typeP = props[typeProp] || {};
        const statusP = props[statusProp] || {};

        const rawDate = dateP?.date?.start;
        if (!rawDate) return null;

        const d = new Date(rawDate);
        const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 10);

        const type =
          typeP?.select?.name || typeP?.multi_select?.[0]?.name || "Other";

        const status = statusP?.status?.name || statusP?.select?.name || "";

        const normalizedStatus = status.toLowerCase().trim();

        return {
          date: localDate,
          type,
          status,
          done: ["done", "completed", "hoàn thành"].includes(normalizedStatus),
        };
      })
      .filter(Boolean);

    return res.status(200).json({ entries });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      detail: err.message,
    });
  }
}
