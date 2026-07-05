# n8n-nodes-earnings-call-transcript-api

An [n8n](https://n8n.io) community node that returns speaker-tagged earnings call transcripts and parsed SEC 8-K filings as structured JSON. It is backed by the [Earnings Call Transcript API](https://apify.com/johnvc/earnings-call-transcript-api?fpr=9n7kx3) on Apify.

Give it tickers and it returns two kinds of records: earnings call transcripts with every speaker turn tagged by name and role, prepared remarks separated from Q&A, and each analyst question paired with the management answers; and SEC 8-K filings parsed item by item from EDGAR with press release text, guidance sentence extraction, and finance-dictionary sentiment scores. A Search operation runs a full-text keyword search across 8-K filings from all US companies. Pay-per-result on Apify, no subscription.

The node also works as an **AI Agent tool**: point an agent at it and it can answer questions like "What guidance did NVDA give on its last earnings call?" with live data.

## Install

1. In n8n, go to **Settings > Community Nodes**.
2. Install `n8n-nodes-earnings-call-transcript-api`.
3. Add your Apify credential (below) and drop the **Earnings Calls and SEC Filings** node into a workflow.

Self-hosted n8n only; community nodes do not run on n8n Cloud.

## Credentials

The node needs an Apify account (free tier works):

1. Get a free account at [apify.com](https://apify.com?fpr=9n7kx3).
2. Copy your API token from [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations).
3. In n8n, create an **Apify API key connection** credential and paste the token (OAuth2 is also supported).

## Resources and operations

| Resource | Operation | What it does |
|---|---|---|
| Filing | Get Many | Parsed 8-K filings for one or more tickers, newest first |
| Filing | Search | Full-text keyword search across 8-K filings from ALL US companies |
| Transcript | Get Many | Speaker-tagged earnings call transcripts, newest quarter first |

Useful options: **Event Categories** (earnings, executive changes, cybersecurity incidents, M&A, and more) and **Item Codes** filter filings; **Date From / Date To** bound the window; **Metadata Only** is a cheap alerting mode; **Only New Records** plus a Schedule trigger turns the node into a filings and transcripts monitor that emits only new records each run.

## Output modes

- **Simplified** (default, and forced when used as an AI tool): a compact record. Filings: ticker, title, filed date, item codes and names, guidance sentences, net sentiment, EDGAR link. Transcripts: ticker, title, quarter, call date, Q&A pairs, guidance sentences, net sentiment.
- **Raw**: every field the API produces.
- **Selected Fields**: pick exactly the fields you want, per resource.

## Output fields

Filing records (`recordType: "filing"`):

| Field | Description |
|---|---|
| `ticker`, `companyName`, `cik` | Company identity |
| `formType`, `accessionNumber`, `filedDate`, `acceptanceDateTime` | Filing identity and EDGAR acceptance timestamp |
| `itemCodes`, `itemNames`, `items` | 8-K item classification (full 1.01-9.01 map) and per-item text |
| `pressRelease` | Parsed EX-99 press release: headline, outlook section, body |
| `guidanceSentences` | Forward-looking sentences with quantities or periods |
| `sentiment`, `sentimentNet` | Finance-dictionary sentiment (deterministic, not an LLM) |
| `matchedSnippets`, `searchKeyword` | Search mode: what matched |
| `url`, `documentUrl`, `pressReleaseUrl` | EDGAR links |

Transcript records (`recordType: "transcript"`):

| Field | Description |
|---|---|
| `title`, `fiscalQuarter`, `fiscalYear`, `callDate` | Call identity |
| `participants` | Roster with name, role, and roleType (executive, analyst, operator) |
| `preparedRemarks` | Speaker-tagged prepared-remarks turns |
| `qaPairs` | Each analyst question paired with the management answers, with firm affiliations |
| `guidanceSentences`, `sentiment`, `sentimentNet` | Guidance and sentiment |
| `speakerCount`, `questionCount`, `wordCount` | Call statistics |

Records with `recordType: "error"` are uncharged notes (for example, no transcript available for a micro cap) and pass through untouched in every mode.

## Example workflows

**Earnings watchlist digest.** Schedule trigger (daily) -> Earnings Calls and SEC Filings (Filing > Get Many, your tickers, Event Categories: Earnings Releases, Only New Records on) -> Slack. Each new earnings 8-K posts once, with guidance sentences and sentiment inline.

**Crisis screener.** Schedule trigger -> Earnings Calls and SEC Filings (Filing > Search, keyword "material weakness", Only New Records on) -> filter on `sentimentNet` -> email digest of newly filed matches across the whole US market.

**AI analyst.** AI Agent node with this node as a tool -> ask "Summarize the Q&A from MSFT's latest earnings call and list any guidance changes." The agent pulls the transcript live and answers from the qaPairs and guidanceSentences fields.

## Pricing

The Actor charges per record returned (a parsed filing or a structured transcript) with no start fee and no subscription; error notes are never charged. See current pricing on [the Actor's page](https://apify.com/johnvc/earnings-call-transcript-api?fpr=9n7kx3).

## Links

- Actor: [Earnings Call Transcript API on Apify](https://apify.com/johnvc/earnings-call-transcript-api?fpr=9n7kx3)
- Quick-start example repo (Python + MCP): [Apify-Earnings-Call-Transcript-API](https://github.com/johnisanerd/Apify-Earnings-Call-Transcript-API)
- Apify n8n integration docs: https://docs.apify.com/platform/integrations/n8n
- n8n community nodes: https://docs.n8n.io/integrations/community-nodes/

## License

MIT
