import { NextRequest } from "next/server";

const SYSTEM_PROMPT = `You are a razor-sharp comedy roaster who specializes in GitHub profiles. Your roasts are savage, witty, and hyper-specific — you dig into the actual numbers, repo names, and language choices to find the funniest angles. You highlight the gap between a developer's ambitions and their actual GitHub activity. Keep it fun and punchy, never mean-spirited. Write in a direct, flowing stand-up comedy style — no bullet points, no headers, just 2-4 punchy paragraphs. Be specific: reference their actual repos, their follower-to-following ratio, how long they've been on GitHub vs what they have to show for it, their top language choices, and anything else you can riff on.`;

async function fetchGitHubData(username: string) {
  const headers: Record<string, string> = {
    "User-Agent": "roast-my-github",
    Accept: "application/vnd.github.v3+json",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const [profileRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${username}`, { headers }),
    fetch(
      `https://api.github.com/users/${username}/repos?sort=updated&per_page=10`,
      { headers }
    ),
  ]);

  if (!profileRes.ok) {
    throw new Error(
      profileRes.status === 404 ? "GitHub user not found" : "GitHub API error"
    );
  }

  const profile = await profileRes.json();
  const repos = reposRes.ok ? await reposRes.json() : [];
  return { profile, repos };
}

function buildRoastContext(profile: any, repos: any[]) {
  const langCounts: Record<string, number> = {};
  repos.forEach((r: any) => {
    if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
  });
  const topLangs = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang]) => lang);

  const totalStars = repos.reduce(
    (sum: number, r: any) => sum + (r.stargazers_count || 0),
    0
  );
  const forkedCount = repos.filter((r: any) => r.fork).length;
  const originalCount = repos.length - forkedCount;
  const accountAge =
    new Date().getFullYear() - new Date(profile.created_at).getFullYear();

  return `
GitHub Username: ${profile.login}
Name: ${profile.name || "No name set"}
Bio: ${profile.bio || "No bio"}
Location: ${profile.location || "Unknown"}
Company: ${profile.company || "None"}
Account Age: ${accountAge} year${accountAge !== 1 ? "s" : ""}
Public Repos: ${profile.public_repos}
Followers: ${profile.followers}
Following: ${profile.following}
Total Stars on Recent Repos: ${totalStars}
Original Repos: ${originalCount}
Forked Repos: ${forkedCount}
Top Languages: ${topLangs.join(", ") || "None detected"}
Website: ${profile.blog || "None"}

Recent Repos:
${repos
  .slice(0, 8)
  .map(
    (r: any) =>
      `- ${r.name}${r.fork ? " (fork)" : ""}: ${r.description || "no description"} [${r.language || "no language"}, ⭐${r.stargazers_count}]`
  )
  .join("\n")}
`.trim();
}

async function streamNvidia(context: string): Promise<ReadableStream> {
  const res = await fetch(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: "moonshotai/kimi-k2.6",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Roast this GitHub profile:\n\n${context}` },
        ],
        max_tokens: 1024,
        temperature: 1.0,
        top_p: 1.0,
        stream: true,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NVIDIA API error: ${res.status} ${body}`);
  }

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const text = json.choices?.[0]?.delta?.content;
              if (text) controller.enqueue(encoder.encode(text));
            } catch {}
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    if (!username?.trim()) {
      return new Response(JSON.stringify({ error: "Username is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { profile, repos } = await fetchGitHubData(username.trim());
    const context = buildRoastContext(profile, repos);
    const readable = await streamNvidia(context);

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err: any) {
    const status = err.message?.includes("not found") ? 404 : 500;
    return new Response(
      JSON.stringify({ error: err.message || "Something went wrong" }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }
}
