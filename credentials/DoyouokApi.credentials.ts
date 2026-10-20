import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class DoyouokApi implements ICredentialType {
	name = 'doyouokApi';

	displayName = 'Doyouok API';

	icon: Icon = {
		light: 'file:../nodes/Doyouok/doyouok.svg',
		dark: 'file:../nodes/Doyouok/doyouok.dark.svg',
	};

	documentationUrl = 'https://github.com/gcesoftware/n8n-nodes-doyouok?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Create one in Doyouok under Profile → API tokens',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://doyouok.com',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/[/]+$/, "")}}/api/v1',
			url: '/me',
		},
	};
}
