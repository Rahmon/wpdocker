'use strict';

const makeInquirer = require('../../../src/commands/create/inquirer');

// Helper: returns a stub prompt that resolves with `answers` immediately.
function stubPrompt(answers) {
	return jest.fn().mockResolvedValue(answers);
}

describe('makeInquirer — marshalDomains (single hostname)', () => {
	it('returns the hostname string when no existing domain is set', async () => {
		const prompt = stubPrompt({ hostname: 'docker.test', phpVersion: '8.2' });
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		expect(result.domain).toBe('docker.test');
	});

	it('passes the existing scalar domain through unchanged', async () => {
		const prompt = stubPrompt({ phpVersion: '8.2' });
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({ domain: 'existing.test' });
		expect(result.domain).toBe('existing.test');
	});

	it('deduplicates when hostname matches a domain already in the defaults array', async () => {
		const prompt = stubPrompt({ hostname: 'a.test', phpVersion: '8.2' });
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({ domain: 'a.test' });
		// domain is already 'a.test' (scalar), hostname == same → Set dedupes → single string
		expect(result.domain).toBe('a.test');
	});
});

describe('makeInquirer — marshalDomains (extra hosts)', () => {
	it('merges extraHosts into the domain array', async () => {
		const prompt = stubPrompt({
			hostname: 'main.test',
			extraHosts: ['alias1.test', 'alias2.test'],
			phpVersion: '8.2',
		});
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		expect(result.domain).toEqual(['main.test', 'alias1.test', 'alias2.test']);
	});

	it('deduplicates repeated extra hosts', async () => {
		const prompt = stubPrompt({
			hostname: 'main.test',
			extraHosts: ['main.test', 'alias.test'],
			phpVersion: '8.2',
		});
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		// 'main.test' added by hostname, 'main.test' in extraHosts is duped → Set removes it
		expect(result.domain).toEqual(['main.test', 'alias.test']);
	});

	it('combines an existing scalar domain with extraHosts', async () => {
		const prompt = stubPrompt({
			extraHosts: ['extra.test'],
			phpVersion: '8.2',
		});
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({ domain: 'existing.test' });
		expect(result.domain).toEqual(['existing.test', 'extra.test']);
	});

	it('combines an existing array domain with a new hostname and extraHosts', async () => {
		const prompt = stubPrompt({
			hostname: 'new.test',
			extraHosts: ['extra.test'],
			phpVersion: '8.2',
		});
		const inquirer = makeInquirer({ prompt });
		// domain is an empty array, so hostname/extraHosts questions fire
		const result = await inquirer({ domain: [] });
		expect(result.domain).toEqual(['new.test', 'extra.test']);
	});
});

describe('makeInquirer — marshalWordPress (boolean true → {})', () => {
	it('expands wordpress:true into an object with title/username/password/email', async () => {
		const prompt = stubPrompt({
			hostname: 'site.test',
			wordpress: true,
			wordpressType: 'single',
			title: 'My Site',
			username: 'admin',
			password: 'secret',
			email: 'admin@example.com',
			phpVersion: '8.2',
		});
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		expect(result.wordpress).toEqual({
			type: 'single',
			title: 'My Site',
			username: 'admin',
			password: 'secret',
			email: 'admin@example.com',
		});
	});

	it('sets purify:true when emptyContent is true', async () => {
		const prompt = stubPrompt({
			hostname: 'site.test',
			wordpress: true,
			wordpressType: 'single',
			title: 'My Site',
			username: 'admin',
			password: 'secret',
			email: 'admin@example.com',
			emptyContent: true,
			phpVersion: '8.2',
		});
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		expect(result.wordpress.purify).toBe(true);
	});

	it('does not set purify when emptyContent is false', async () => {
		const prompt = stubPrompt({
			hostname: 'site.test',
			wordpress: true,
			wordpressType: 'single',
			title: 'My Site',
			username: 'admin',
			password: 'secret',
			email: 'admin@example.com',
			emptyContent: false,
			phpVersion: '8.2',
		});
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		expect(result.wordpress.purify).toBeUndefined();
	});

	it('maps wordpressType subdirectory correctly', async () => {
		const prompt = stubPrompt({
			hostname: 'ms.test',
			wordpress: true,
			wordpressType: 'subdirectory',
			title: 'MS',
			username: 'admin',
			password: 'password',
			email: 'a@b.com',
			phpVersion: '8.2',
		});
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		expect(result.wordpress.type).toBe('subdirectory');
	});

	it('maps wordpressType subdomain correctly', async () => {
		const prompt = stubPrompt({
			hostname: 'ms.test',
			wordpress: true,
			wordpressType: 'subdomain',
			title: 'MS',
			username: 'admin',
			password: 'password',
			email: 'a@b.com',
			phpVersion: '8.2',
		});
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		expect(result.wordpress.type).toBe('subdomain');
	});
});

describe('makeInquirer — marshalWordPress (existing object defaults)', () => {
	it('merges answers into a pre-existing wordpress object', async () => {
		const prompt = stubPrompt({
			title: 'New Title',
			username: 'newuser',
			password: 'newpass',
			email: 'new@e.com',
			phpVersion: '8.2',
		});
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({
			wordpress: { type: 'single', title: undefined },
		});
		expect(result.wordpress.title).toBe('New Title');
		expect(result.wordpress.username).toBe('newuser');
	});
});

describe('makeInquirer — top-level field passthrough', () => {
	it('uses the php version from defaults when already set', async () => {
		const prompt = stubPrompt({ hostname: 'site.test' });
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({ php: '8.1' });
		expect(result.php).toBe('8.1');
	});

	it('uses phpVersion from answers when php not in defaults', async () => {
		const prompt = stubPrompt({ hostname: 'site.test', phpVersion: '7.4' });
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		expect(result.php).toBe('7.4');
	});

	it('uses the name from defaults when set', async () => {
		const prompt = stubPrompt({ hostname: 'site.test', phpVersion: '8.2' });
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({ name: 'my-project' });
		expect(result.name).toBe('my-project');
	});

	it('falls back to answers.title for name when not in defaults', async () => {
		const prompt = stubPrompt({
			hostname: 'site.test',
			title: 'Derived Name',
			wordpress: true,
			wordpressType: 'single',
			username: 'admin',
			password: 'pass',
			email: 'a@b.com',
			phpVersion: '8.2',
		});
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		expect(result.name).toBe('Derived Name');
	});

	it('sets elasticsearch from answers when not in defaults', async () => {
		const prompt = stubPrompt({
			hostname: 'site.test',
			phpVersion: '8.2',
			elasticsearch: true,
		});
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		expect(result.elasticsearch).toBe(true);
	});

	it('defaults elasticsearch to false when neither defaults nor answers set it', async () => {
		const prompt = stubPrompt({ hostname: 'site.test', phpVersion: '8.2' });
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		expect(result.elasticsearch).toBe(false);
	});

	it('sets mediaProxy to the proxy answer when present', async () => {
		const prompt = stubPrompt({
			hostname: 'site.test',
			phpVersion: '8.2',
			proxy: 'http://proxy.example.com',
		});
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		expect(result.mediaProxy).toBe('http://proxy.example.com');
	});

	it('sets mediaProxy to false when proxy answer is absent', async () => {
		const prompt = stubPrompt({ hostname: 'site.test', phpVersion: '8.2' });
		const inquirer = makeInquirer({ prompt });
		const result = await inquirer({});
		expect(result.mediaProxy).toBe(false);
	});
});
