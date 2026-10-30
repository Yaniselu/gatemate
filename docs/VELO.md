# Velo — the AI travel agent

Velo is Gatemate's built-in travel agent, made by Velosyntech and powered by Claude (`claude-opus-5-5`). It
answers in the traveller's app language and works with their real data:

| Tool | What it does |
|---|---|
| `get_my_trips`, `get_flight` | The traveller's own trips and flights: local times, gate, seat, live status, baggage |
| `find_airport` | Airports by code, city or name, with the local time |
| `get_destination_guide` | Currency, plugs, emergency numbers, driving side, top sights, public holidays on the dates |
| `convert_currency` | ECB exchange rates |
| `estimate_compensation` | EU261 compensation band from the route distance |
| `add_checklist_items` | Adds items to a trip checklist (the app refreshes the trip) |
| web search | Up-to-date entry rules, strikes, opening hours, with sources shown in the app |

One-tap jobs on the Velo screen (prepare my trip, airport day plan, destination briefing, delayed flight, entry rules,
packing) and on each trip (prepare the checklist, ask about the destination) run the same agent.

## Switching it on

1. Create an API key at console.anthropic.com (Settings → API keys) and set a monthly spend limit there.
2. In the Render dashboard → gatemate-api → Environment, add `ANTHROPIC_API_KEY` with that key. Never put it in git or
   in the app.
3. Redeploy. Until the key is set, Velo shows "getting ready" and the server refuses chat requests.

Optional: `ASSISTANT_MODEL` (default `claude-opus-5-5`) and `ASSISTANT_EFFORT` (default `low`, fastest replies;
`medium` thinks more before answering).

### Alternative: Google Gemini (free tier)

1. Create a key at aistudio.google.com (Get API key).
2. In Render → gatemate-api → Environment, add `GEMINI_API_KEY` and leave `ANTHROPIC_API_KEY` unset (when both are set,
   Claude is used). Redeploy; the log says `Velo runs on Gemini (…)`.

Optional: `GEMINI_MODEL` (default `gemini-flash-latest`). Same tools, streaming and limits; there's no web search on
Gemini, so Velo points to the official source for things that change. On Google's free tier, prompts may be used by
Google to improve its products and the per-minute and per-day quotas are low: when they run out, Velo answers
"busy" until the quota resets. A billing-enabled Google project lifts both.

## Limits and cost control

- 20 messages a day on the free plan, 200 with Gatemate Pro (reset at midnight UTC), plus at most 6 a minute.
- At most 24 conversations at once per server; each answer has at most 10 tool rounds and 3 web searches.
- The system prompt and tools are cached (1 hour), and so is the conversation between tool rounds, so repeated
  context is billed at the cached rate. Token use per turn is logged (`assistant turn: in=… cached=… out=…`).

## Privacy and safety

- The conversation stays on the phone; the server keeps no transcript.
- The model never receives booking references, passenger names or e-mail addresses — only the traveller's first name,
  home airport and language.
- Tools act only as the signed-in traveller; another traveller's trip ids return "not found".
- If Claude's safety classifiers decline a request, the API re-runs it on the model Anthropic recommends
  (`fallbacks: "default"`); if that also declines, the app says Velo can't help with that.
