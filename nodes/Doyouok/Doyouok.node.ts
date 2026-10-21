import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

// Checks created by this node are owned by source "n8n" + "<instanceId>:<workflowId>" on the Doyouok side,
// so a workflow keeps the same check across renames (the name is re-synced whenever it changes).
const SOURCE = 'n8n';
const MINUTES_PER_UNIT: Record<string, number> = { minutes: 1, hours: 60, days: 1440 };

// What the last successful registration returned, kept in the workflow's static data. Runs are
// pinged straight to the stored ping URL (Doyouok's highly available ping service); the website is
// only called again when the registration input changes or the ping URL stops working (404).
interface Registration {
	key: string;
	checkId: string;
	name: string;
	pingUrl: string;
}

async function doyouokRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
) {
	const { baseUrl } = await this.getCredentials<{ baseUrl: string }>('doyouokApi');
	return await this.helpers.httpRequestWithAuthentication.call(this, 'doyouokApi', {
		method,
		url: `${baseUrl.replace(/\/+$/, '')}/api/v1${path}`,
		body,
		json: true,
	});
}

async function register(this: IExecuteFunctions, key: string, body: IDataObject): Promise<Registration> {
	let response: IDataObject;
	try {
		response = (await doyouokRequest.call(this, 'POST', '/register', body)) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
	return {
		key,
		checkId: response.checkId as string,
		name: response.name as string,
		pingUrl: response.pingUrl as string,
	};
}

/** Returns the ping service's HTTP status: 200 when recorded (or the check is paused), 404 for an unknown ping key. */
async function ping(this: IExecuteFunctions, pingUrl: string, failed: boolean, reason?: string) {
	try {
		const response = await this.helpers.httpRequest({
			method: 'POST',
			url: `${pingUrl}/${failed ? 'fail' : 'success'}`,
			body: failed ? reason : undefined,
			headers: failed ? { 'Content-Type': 'text/plain' } : undefined,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		});
		return response.statusCode as number;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export class Doyouok implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Doyouok',
		name: 'doyouok',
		icon: { light: 'file:doyouok.svg', dark: 'file:doyouok.dark.svg' },
		group: ['output'],
		version: [1],
		subtitle: '={{ $parameter["result"] === "conditions" ? "Report run (check conditions)" : "Report run" }}',
		description: 'Report workflow runs to Doyouok and get alerted on missed or silently failed runs',
		defaults: {
			name: 'Doyouok',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'doyouokApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Check',
				name: 'check',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'This Workflow (Automatic)',
						value: 'auto',
						description: 'Create the check on the first run and keep its name in sync with this workflow',
					},
					{
						name: 'Existing Check',
						value: 'existing',
						description: 'Report to a check you created in Doyouok',
					},
				],
				default: 'auto',
			},
			{
				displayName: 'Check Name or ID',
				name: 'checkId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getChecks',
				},
				required: true,
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				displayOptions: {
					show: {
						check: ['existing'],
					},
				},
			},
			{
				displayName: 'Expected Every',
				name: 'interval',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'How often this workflow should run. Doyouok alerts you when a run is overdue.',
				displayOptions: {
					show: {
						check: ['auto'],
					},
				},
			},
			{
				displayName: 'Unit',
				name: 'intervalUnit',
				type: 'options',
				options: [
					{ name: 'Minutes', value: 'minutes' },
					{ name: 'Hours', value: 'hours' },
					{ name: 'Days', value: 'days' },
				],
				default: 'days',
				displayOptions: {
					show: {
						check: ['auto'],
					},
				},
			},
			{
				displayName: 'Result',
				name: 'result',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Check Conditions',
						value: 'conditions',
						description: 'Success only if every input item matches the conditions below',
					},
					{
						name: 'Success',
						value: 'success',
						description: 'Always report a successful run',
					},
					{
						name: 'Failure',
						value: 'failure',
						description: 'Always report a failed run, e.g. on an error branch',
					},
				],
				default: 'conditions',
			},
			{
				displayName: 'Conditions',
				name: 'conditions',
				type: 'filter',
				default: {},
				typeOptions: {
					filter: {
						caseSensitive: false,
						typeValidation: 'loose',
						version: 2,
					},
				},
				description: 'E.g. result contains "success", or processedCount is greater than 0.',
				displayOptions: {
					show: {
						result: ['conditions'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Failure Message',
						name: 'failureMessage',
						type: 'string',
						default: '',
						description: 'Shown in the Doyouok alert when the run is reported as failed',
					},
					{
						displayName: 'Client Name',
						name: 'clientName',
						type: 'string',
						default: '',
						description: 'Agency plans: the client this check belongs to (used when the check is created)',
						displayOptions: {
							show: {
								'/check': ['auto'],
							},
						},
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getChecks(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const checks = (await doyouokRequest.call(this, 'GET', '/checks')) as Array<{
					id: string;
					name: string;
				}>;
				return checks.map((c) => ({ name: c.name, value: c.id }));
			},
		},
	};

	// One report per execution: all input items are judged together, so the whole run passes or fails.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const pairedItem = items.map((_, i) => ({ item: i }));

		try {
			const body: IDataObject = {};
			if (this.getNodeParameter('check', 0) === 'existing') {
				body.checkId = this.getNodeParameter('checkId', 0) as string;
			} else {
				const workflow = this.getWorkflow();
				if (!workflow.id) {
					throw new NodeOperationError(this.getNode(), 'Save the workflow first so Doyouok can link a check to it');
				}
				const interval = this.getNodeParameter('interval', 0) as number;
				const unit = this.getNodeParameter('intervalUnit', 0) as string;
				body.source = SOURCE;
				body.externalId = `${this.getInstanceId()}:${workflow.id}`;
				body.name = workflow.name;
				body.intervalMinutes = Math.round(interval * MINUTES_PER_UNIT[unit]);
				body.clientName = (this.getNodeParameter('options.clientName', 0, '') as string) || undefined;
			}

			const result = this.getNodeParameter('result', 0) as string;
			let failedIndex = -1;
			if (result === 'failure') {
				failedIndex = 0;
			} else if (result === 'conditions') {
				failedIndex = items.findIndex(
					(_, i) => !this.getNodeParameter('conditions', i, false, { extractValue: true }),
				);
			}

			const failed = failedIndex !== -1;
			let reason: string | undefined;
			if (failed) {
				const message = this.getNodeParameter('options.failureMessage', failedIndex, '') as string;
				reason =
					message ||
					(result === 'conditions'
						? `Success conditions not met (item ${failedIndex + 1} of ${items.length})`
						: 'Reported as failed');
			}

			// Re-register when anything that decides the check changes, including the credential or base URL.
			const { baseUrl } = await this.getCredentials<{ baseUrl: string }>('doyouokApi');
			const key = JSON.stringify([this.getNode().credentials?.doyouokApi?.id, baseUrl, body]);
			const staticData = this.getWorkflowStaticData('node') as { registration?: Registration };
			let registration = staticData.registration;
			let fresh = false;
			if (registration?.key !== key) {
				registration = await register.call(this, key, body);
				fresh = true;
			}

			let status = await ping.call(this, registration.pingUrl, failed, reason);
			// 404 on a stored URL: the check was deleted or its ping URL rotated in Doyouok; register again.
			if (status === 404 && !fresh) {
				registration = await register.call(this, key, body);
				status = await ping.call(this, registration.pingUrl, failed, reason);
			}
			// A just-created or rotated ping URL is accepted once the ping service reloads its keys (every 10 seconds).
			for (let attempt = 0; status === 404 && attempt < 3; attempt++) {
				await sleep(5000);
				status = await ping.call(this, registration.pingUrl, failed, reason);
			}
			if (status === 404) {
				throw new NodeOperationError(this.getNode(), 'Doyouok did not accept the ping URL it returned');
			}
			staticData.registration = registration;

			const response: IDataObject = {
				checkId: registration.checkId,
				name: registration.name,
				status: failed ? 'fail' : 'success',
				reason,
			};
			return [[{ json: response, pairedItem }]];
		} catch (error) {
			if (this.continueOnFail()) {
				return [[{ json: { error: (error as Error).message }, pairedItem }]];
			}
			throw error instanceof NodeApiError ? error : new NodeOperationError(this.getNode(), error as Error);
		}
	}
}
