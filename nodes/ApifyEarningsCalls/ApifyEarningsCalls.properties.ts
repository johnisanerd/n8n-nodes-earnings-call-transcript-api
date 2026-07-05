import { IExecuteFunctions, INodeProperties } from 'n8n-workflow';

/**
 * Build the Apify Actor input from node parameters.
 * Only the real Actor inputs are sent; the Output / Fields parameters shape the
 * data we return, they are not part of the Actor input. Prefills from the build
 * are dropped so the demo ticker never leaks into a user's run.
 */
export function buildActorInput(
	context: IExecuteFunctions,
	itemIndex: number,
	defaultInput: Record<string, any>,
): Record<string, any> {
	const input: Record<string, any> = { ...defaultInput };
	delete input.tickers;
	delete input.searchKeyword;
	delete input.dataType;

	const resource = context.getNodeParameter('resource', itemIndex, 'filing') as string;
	const operation = context.getNodeParameter('operation', itemIndex, 'getMany') as string;

	if (resource === 'filing' && operation === 'search') {
		const keyword = context.getNodeParameter('searchKeyword', itemIndex, '') as string;
		if (keyword) input.searchKeyword = keyword.trim();
		input.dataType = 'filings';
	} else {
		input.dataType = resource === 'transcript' ? 'transcripts' : 'filings';
	}

	const tickersRaw = context.getNodeParameter('tickers', itemIndex, '') as string;
	const tickers = (tickersRaw || '')
		.split(/[\s,;]+/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (tickers.length) input.tickers = tickers;

	if (resource === 'filing') {
		const filingsLimit = context.getNodeParameter('filingsLimit', itemIndex, 10) as number;
		if (filingsLimit) input.filingsLimit = filingsLimit;
		const categories = context.getNodeParameter('eventCategories', itemIndex, []) as string[];
		if (categories?.length) input.eventCategories = categories;
		const itemCodesRaw = context.getNodeParameter('itemCodes', itemIndex, '') as string;
		const itemCodes = (itemCodesRaw || '')
			.split(/[\s,;]+/)
			.map((s) => s.trim())
			.filter(Boolean);
		if (itemCodes.length) input.itemCodes = itemCodes;
		const metadataOnly = context.getNodeParameter('metadataOnly', itemIndex, false) as boolean;
		if (metadataOnly) input.metadataOnly = true;
	} else {
		const transcriptsLimit = context.getNodeParameter('transcriptsLimit', itemIndex, 4) as number;
		if (transcriptsLimit) input.transcriptsLimit = transcriptsLimit;
	}

	const dateFrom = context.getNodeParameter('dateFrom', itemIndex, '') as string;
	const dateTo = context.getNodeParameter('dateTo', itemIndex, '') as string;
	if (dateFrom) input.dateFrom = dateFrom.slice(0, 10);
	if (dateTo) input.dateTo = dateTo.slice(0, 10);

	const includeFullText = context.getNodeParameter('includeFullText', itemIndex, false) as boolean;
	if (includeFullText) input.includeFullText = true;
	const onlyNew = context.getNodeParameter('onlyNew', itemIndex, false) as boolean;
	if (onlyNew) input.onlyNew = true;

	return input;
}

const resourceProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Filing',
				value: 'filing',
			},
			{
				name: 'Transcript',
				value: 'transcript',
			},
		],
		default: 'filing',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['filing'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get filings for one or more tickers',
				description: 'Return parsed 8-K filings for the given tickers, newest first',
			},
			{
				name: 'Search',
				value: 'search',
				action: 'Search filings across all companies',
				description: 'Full-text search 8-K filings from all US companies for a word or phrase',
			},
		],
		default: 'getMany',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['transcript'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get transcripts for one or more tickers',
				description: 'Return speaker-tagged earnings call transcripts, newest quarter first',
			},
		],
		default: 'getMany',
	},
];

const inputProperties: INodeProperties[] = [
	{
		displayName: 'Tickers',
		name: 'tickers',
		type: 'string',
		default: '',
		placeholder: 'e.g. AAPL, NVDA, MSFT',
		description:
			'Stock ticker symbols or CIK numbers, separated by commas, spaces, or new lines. In Search, tickers are an optional company filter.',
		displayOptions: { show: { resource: ['filing', 'transcript'] } },
	},
	{
		displayName: 'Search Keyword',
		name: 'searchKeyword',
		type: 'string',
		default: '',
		placeholder: 'e.g. guidance withdrawal',
		description:
			'Word or phrase to search across 8-K filings from all US companies, for example "material weakness" or "going concern"',
		displayOptions: { show: { resource: ['filing'], operation: ['search'] } },
	},
	{
		displayName: 'Max Filings',
		name: 'filingsLimit',
		type: 'number',
		default: 10,
		typeOptions: { minValue: 1, maxValue: 200 },
		description:
			'How many filings to return per ticker, newest first. In Search, caps total results across all companies.',
		displayOptions: { show: { resource: ['filing'] } },
	},
	{
		displayName: 'Max Transcripts',
		name: 'transcriptsLimit',
		type: 'number',
		default: 4,
		typeOptions: { minValue: 1, maxValue: 40 },
		description: 'How many transcripts to return per ticker, newest quarter first (4 covers one year)',
		displayOptions: { show: { resource: ['transcript'] } },
	},
	{
		displayName: 'Event Categories',
		name: 'eventCategories',
		type: 'multiOptions',
		default: [],
		description: 'Only return filings reporting these kinds of events. Each maps to the matching 8-K item codes.',
		displayOptions: { show: { resource: ['filing'] } },
		options: [
			{ name: 'Accounting Issues (4.01, 4.02)', value: 'accounting_issues' },
			{ name: 'Bankruptcy (1.03)', value: 'bankruptcy' },
			{ name: 'Cybersecurity Incidents (1.05)', value: 'cybersecurity' },
			{ name: 'Delisting Notices (3.01)', value: 'delisting' },
			{ name: 'Earnings Releases (2.02)', value: 'earnings' },
			{ name: 'Executive Changes (5.02)', value: 'executive_changes' },
			{ name: 'Governance and Votes (5.01, 5.03, 5.07)', value: 'governance' },
			{ name: 'Guidance and Reg FD (2.02, 7.01)', value: 'guidance' },
			{ name: 'Mergers and Acquisitions (1.01, 1.02, 2.01)', value: 'mergers_acquisitions' },
			{ name: 'Other Events (8.01)', value: 'other_events' },
			{ name: 'Restructuring and Impairments (2.05, 2.06)', value: 'restructuring' },
		],
	},
	{
		displayName: 'Item Codes',
		name: 'itemCodes',
		type: 'string',
		default: '',
		placeholder: 'e.g. 2.02, 5.02',
		description:
			'Exact 8-K item codes to filter on, separated by commas (any code from 1.01 through 9.01). Combines with Event Categories.',
		displayOptions: { show: { resource: ['filing'] } },
	},
	{
		displayName: 'Date From',
		name: 'dateFrom',
		type: 'string',
		default: '',
		placeholder: 'e.g. 2026-01-01',
		description:
			'Only return records dated on or after this date (YYYY-MM-DD). Empty means roughly the last 12 months.',
		displayOptions: { show: { resource: ['filing', 'transcript'] } },
	},
	{
		displayName: 'Date To',
		name: 'dateTo',
		type: 'string',
		default: '',
		placeholder: 'e.g. 2026-06-30',
		description: 'Only return records dated on or before this date (YYYY-MM-DD)',
		displayOptions: { show: { resource: ['filing', 'transcript'] } },
	},
	{
		displayName: 'Include Full Text',
		name: 'includeFullText',
		type: 'boolean',
		default: false,
		description:
			'Whether to include the complete filing text, press release body, and transcript in every record. Structured fields are always included.',
		displayOptions: { show: { resource: ['filing', 'transcript'] } },
	},
	{
		displayName: 'Metadata Only',
		name: 'metadataOnly',
		type: 'boolean',
		default: false,
		description:
			'Whether to skip document parsing and return filing metadata and item codes only. The cheapest mode for alerting.',
		displayOptions: { show: { resource: ['filing'] } },
	},
	{
		displayName: 'Only New Records',
		name: 'onlyNew',
		type: 'boolean',
		default: false,
		description:
			'Whether to skip records already returned by previous runs. Combine with a schedule to emit only newly filed 8-Ks and newly published transcripts.',
		displayOptions: { show: { resource: ['filing', 'transcript'] } },
	},
];

const outputProperties: INodeProperties[] = [
	{
		displayName: 'Output',
		name: 'output',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Raw',
				value: 'raw',
				description: 'Return every field the API produces for each record',
			},
			{
				name: 'Selected Fields',
				value: 'selected',
				description: 'Choose exactly which fields to return',
			},
			{
				name: 'Simplified',
				value: 'simplified',
				description: 'Return a compact set of the most useful fields',
			},
		],
		default: 'simplified',
		description: 'How much data to return for each record',
	},
	{
		displayName: 'Fields to Include',
		name: 'fieldsFiling',
		type: 'multiOptions',
		displayOptions: {
			show: { resource: ['filing'], output: ['selected'] },
		},
		options: [
			{ name: 'Acceptance Date Time', value: 'acceptanceDateTime' },
			{ name: 'Accession Number', value: 'accessionNumber' },
			{ name: 'CIK', value: 'cik' },
			{ name: 'Company Name', value: 'companyName' },
			{ name: 'Document URL', value: 'documentUrl' },
			{ name: 'Event Date', value: 'eventDate' },
			{ name: 'Filed Date', value: 'filedDate' },
			{ name: 'Filing URL', value: 'url' },
			{ name: 'Form Type', value: 'formType' },
			{ name: 'Full Text', value: 'fullText' },
			{ name: 'Guidance Sentences', value: 'guidanceSentences' },
			{ name: 'Item Codes', value: 'itemCodes' },
			{ name: 'Item Names', value: 'itemNames' },
			{ name: 'Itemized Sections', value: 'items' },
			{ name: 'Matched Document', value: 'matchedDocument' },
			{ name: 'Matched Snippets', value: 'matchedSnippets' },
			{ name: 'Press Release', value: 'pressRelease' },
			{ name: 'Press Release URL', value: 'pressReleaseUrl' },
			{ name: 'Record Type', value: 'recordType' },
			{ name: 'Report Date', value: 'reportDate' },
			{ name: 'Search Keyword', value: 'searchKeyword' },
			{ name: 'Sentiment Detail', value: 'sentiment' },
			{ name: 'Sentiment Net', value: 'sentimentNet' },
			{ name: 'Ticker', value: 'ticker' },
			{ name: 'Title', value: 'title' },
		],
		default: ['recordType', 'ticker', 'companyName', 'title', 'filedDate', 'itemCodes', 'guidanceSentences', 'sentimentNet', 'url'],
		description: 'Which fields to return when Output is set to Selected Fields',
	},
	{
		displayName: 'Fields to Include',
		name: 'fieldsTranscript',
		type: 'multiOptions',
		displayOptions: {
			show: { resource: ['transcript'], output: ['selected'] },
		},
		options: [
			{ name: 'Call Date', value: 'callDate' },
			{ name: 'CIK', value: 'cik' },
			{ name: 'Company Name', value: 'companyName' },
			{ name: 'Event Date', value: 'eventDate' },
			{ name: 'Fiscal Quarter', value: 'fiscalQuarter' },
			{ name: 'Fiscal Year', value: 'fiscalYear' },
			{ name: 'Full Text', value: 'fullText' },
			{ name: 'Guidance Sentences', value: 'guidanceSentences' },
			{ name: 'Participants', value: 'participants' },
			{ name: 'Prepared Remarks', value: 'preparedRemarks' },
			{ name: 'Q&A Pairs', value: 'qaPairs' },
			{ name: 'Question Count', value: 'questionCount' },
			{ name: 'Record Type', value: 'recordType' },
			{ name: 'Sentiment Detail', value: 'sentiment' },
			{ name: 'Sentiment Net', value: 'sentimentNet' },
			{ name: 'Speaker Count', value: 'speakerCount' },
			{ name: 'Ticker', value: 'ticker' },
			{ name: 'Title', value: 'title' },
			{ name: 'Word Count', value: 'wordCount' },
		],
		default: ['recordType', 'ticker', 'title', 'fiscalQuarter', 'callDate', 'qaPairs', 'guidanceSentences', 'sentimentNet'],
		description: 'Which fields to return when Output is set to Selected Fields',
	},
];

const authenticationProperties: INodeProperties[] = [
	{
		displayName: 'Authentication',
		name: 'authentication',
		type: 'options',
		options: [
			{
				name: 'API Key',
				value: 'apifyApi',
			},
			{
				name: 'OAuth2',
				value: 'apifyOAuth2Api',
			},
		],
		default: 'apifyApi',
		description: 'Choose which authentication method to use',
	},
];

export const properties: INodeProperties[] = [
	...resourceProperties,
	...inputProperties,
	...outputProperties,
	...authenticationProperties,
];
