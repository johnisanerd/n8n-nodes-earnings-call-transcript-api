import { IExecuteFunctions, INodeExecutionData, NodeApiError } from 'n8n-workflow';
import { apiRequest, getResults, isUsedAsAiTool, pollRunStatus } from './genericFunctions';
import { ACTOR_ID } from '../ApifyEarningsCalls.node';
import { buildActorInput } from '../ApifyEarningsCalls.properties';

export async function getDefaultBuild(this: IExecuteFunctions, actorId: string) {
	const defaultBuildResp = await apiRequest.call(this, {
		method: 'GET',
		uri: `/v2/acts/${actorId}/builds/default`,
	});
	if (!defaultBuildResp?.data) {
		throw new NodeApiError(this.getNode(), {
			message: `Could not fetch default build for Actor ${actorId}`,
		});
	}
	return defaultBuildResp.data;
}

export function getDefaultInputsFromBuild(build: any) {
	const buildInputProperties = build?.actorDefinition?.input?.properties;
	const defaultInput: Record<string, any> = {};
	if (buildInputProperties && typeof buildInputProperties === 'object') {
		for (const [key, property] of Object.entries(buildInputProperties)) {
			if (
				property &&
				typeof property === 'object' &&
				'prefill' in property &&
				(property as any).prefill !== undefined &&
				(property as any).prefill !== null
			) {
				defaultInput[key] = (property as any).prefill;
			}
		}
	}
	return defaultInput;
}

export async function runActorApi(
	this: IExecuteFunctions,
	actorId: string,
	mergedInput: Record<string, any>,
	qs: Record<string, any>,
) {
	return await apiRequest.call(this, {
		method: 'POST',
		uri: `/v2/acts/${actorId}/runs`,
		body: mergedInput,
		qs,
	});
}

/**
 * Shape a single record according to the chosen Output mode. The dataset is
 * per-item-flat with a recordType discriminator: 'filing' (a parsed 8-K),
 * 'transcript' (a structured earnings call), or 'error' (an uncharged note,
 * always passed through untouched so the reason is visible).
 * - simplified: a small, LLM-friendly object (also forced when used as an AI tool)
 * - selected: only the picked fields, using the Actor's own keys
 * - raw: the item untouched
 */
function shapeItem(
	item: Record<string, any>,
	mode: string,
	fields: string[],
): Record<string, any> {
	if (mode === 'raw' || item.recordType === 'error') {
		return item;
	}
	if (mode === 'selected') {
		const picked: Record<string, any> = {};
		for (const field of fields) {
			if (field in item) {
				picked[field] = item[field];
			}
		}
		return picked;
	}
	// simplified
	if (item.recordType === 'transcript') {
		return {
			recordType: item.recordType,
			ticker: item.ticker,
			companyName: item.companyName,
			title: item.title,
			callDate: item.callDate,
			fiscalQuarter: item.fiscalQuarter,
			speakerCount: item.speakerCount,
			questionCount: item.questionCount,
			qaPairs: item.qaPairs,
			guidanceSentences: item.guidanceSentences,
			sentimentNet: item.sentimentNet,
		};
	}
	return {
		recordType: item.recordType,
		ticker: item.ticker,
		companyName: item.companyName,
		title: item.title,
		filedDate: item.filedDate,
		itemCodes: item.itemCodes,
		itemNames: item.itemNames,
		guidanceSentences: item.guidanceSentences,
		sentimentNet: item.sentimentNet,
		matchedSnippets: item.matchedSnippets,
		url: item.url,
	};
}

export async function runActor(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const build = await getDefaultBuild.call(this, ACTOR_ID);
	const defaultInput = getDefaultInputsFromBuild(build);
	const mergedInput = buildActorInput(this, i, defaultInput);

	const run = await runActorApi.call(this, ACTOR_ID, mergedInput, { waitForFinish: 0 });
	if (!run?.data?.id) {
		throw new NodeApiError(this.getNode(), {
			message: 'Run ID not found after starting the Actor',
		});
	}

	const runId = run.data.id;
	const datasetId = run.data.defaultDatasetId;
	await pollRunStatus.call(this, runId);
	const items = await getResults.call(this, datasetId);

	let mode = this.getNodeParameter('output', i, 'simplified') as string;
	if (isUsedAsAiTool(this.getNode().type)) {
		mode = 'simplified';
	}
	const resource = this.getNodeParameter('resource', i, 'filing') as string;
	const fieldsParam = resource === 'transcript' ? 'fieldsTranscript' : 'fieldsFiling';
	const fields = (this.getNodeParameter(fieldsParam, i, []) as string[]) ?? [];

	const shaped = items.map((item) => shapeItem(item, mode, fields));
	return this.helpers.returnJsonArray(shaped);
}
