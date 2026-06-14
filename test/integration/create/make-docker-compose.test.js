'use strict';

jest.mock('../../../src/configure');

// Variable must be prefixed with 'mock' to be accessible inside jest.mock factory
const mockOs = {
	platform: jest.fn(),
};
jest.mock('os', () => mockOs);

const { images } = require('../../../src/docker-images');
const { cacheVolume } = require('../../../src/env-utils');

const SNAPSHOTS_PATH = '/home/testuser/.wpsnapshots';

describe('makeDockerCompose', () => {
	let makeDockerCompose;
	let mockConfig;

	beforeEach(() => {
		jest.resetModules();

		// Re-require after resetModules so mocks are fresh
		jest.mock('../../../src/configure');
		mockConfig = require('../../../src/configure');
		mockConfig.get = jest.fn().mockResolvedValue(SNAPSHOTS_PATH);

		// Default to non-linux platform
		mockOs.platform.mockReturnValue('darwin');

		// After mocks are set up, require the module under test
		makeDockerCompose = require('../../../src/commands/create/make-docker-compose');
	});

	function baseSettings(overrides = {}) {
		return {
			envSlug: 'mysite-test',
			php: '8.2',
			wordpress: { type: 'standard' },
			elasticsearch: false,
			certs: false,
			...overrides,
		};
	}

	const baseHosts = ['mysite.test'];

	// -----------------------------------------------------------------------
	// PHP version → correct image
	// -----------------------------------------------------------------------
	it('uses the correct phpfpm image for php8.2', async () => {
		const fn = makeDockerCompose(null);
		const result = await fn(baseHosts, baseSettings({ php: '8.2' }));
		expect(result.services.phpfpm.image).toBe(images['php8.2']);
	});

	it('uses the correct phpfpm image for php7.4', async () => {
		const fn = makeDockerCompose(null);
		const result = await fn(baseHosts, baseSettings({ php: '7.4' }));
		expect(result.services.phpfpm.image).toBe(images['php7.4']);
	});

	// -----------------------------------------------------------------------
	// CERT_NAME: certs on/off
	// -----------------------------------------------------------------------
	it('sets CERT_NAME to envSlug when certs is true', async () => {
		const fn = makeDockerCompose(null);
		const result = await fn(baseHosts, baseSettings({ certs: true, envSlug: 'mysite-test' }));
		expect(result.services.nginx.environment.CERT_NAME).toBe('mysite-test');
	});

	it('sets CERT_NAME to localhost when certs is false', async () => {
		const fn = makeDockerCompose(null);
		const result = await fn(baseHosts, baseSettings({ certs: false }));
		expect(result.services.nginx.environment.CERT_NAME).toBe('localhost');
	});

	// -----------------------------------------------------------------------
	// VIRTUAL_HOST includes wildcard hosts
	// -----------------------------------------------------------------------
	it('sets VIRTUAL_HOST to host + wildcard', async () => {
		const fn = makeDockerCompose(null);
		const result = await fn(['mysite.test'], baseSettings());
		expect(result.services.nginx.environment.VIRTUAL_HOST).toBe('mysite.test,*.mysite.test');
	});

	// -----------------------------------------------------------------------
	// wordpress type: dev branch vs non-dev
	// -----------------------------------------------------------------------
	it('uses develop.conf nginx config and wp-cli develop volume when type is dev', async () => {
		const fn = makeDockerCompose(null);
		const result = await fn(baseHosts, baseSettings({ wordpress: { type: 'dev' } }));
		const nginxVolumes = result.services.nginx.volumes;
		const phpfpmVolumes = result.services.phpfpm.volumes;
		expect(nginxVolumes.some((v) => v.includes('develop.conf'))).toBe(true);
		expect(phpfpmVolumes.some((v) => v.includes('wp-cli.develop.yml'))).toBe(true);
	});

	it('uses default.conf nginx config and wp-cli local volume when type is not dev', async () => {
		const fn = makeDockerCompose(null);
		const result = await fn(baseHosts, baseSettings({ wordpress: { type: 'standard' } }));
		const nginxVolumes = result.services.nginx.volumes;
		const phpfpmVolumes = result.services.phpfpm.volumes;
		expect(nginxVolumes.some((v) => v.includes('default.conf'))).toBe(true);
		expect(phpfpmVolumes.some((v) => v.includes('wp-cli.local.yml'))).toBe(true);
	});

	// -----------------------------------------------------------------------
	// Elasticsearch: on/off
	// -----------------------------------------------------------------------
	it('does not add elasticsearch service when elasticsearch is false', async () => {
		const fn = makeDockerCompose(null);
		const result = await fn(baseHosts, baseSettings({ elasticsearch: false }));
		expect(result.services.elasticsearch).toBeUndefined();
		expect(result.volumes.elasticsearchData).toBeUndefined();
	});

	it('adds elasticsearch service and volume when elasticsearch is true', async () => {
		const fn = makeDockerCompose(null);
		const result = await fn(baseHosts, baseSettings({ elasticsearch: true }));
		expect(result.services.elasticsearch).toBeDefined();
		expect(result.services.elasticsearch.image).toBe(images['elasticsearch']);
		expect(result.services.elasticsearch.expose).toEqual(['9200']);
		expect(result.volumes.elasticsearchData).toBeDefined();
		expect(result.services.phpfpm.depends_on).toContain('elasticsearch');
	});

	// -----------------------------------------------------------------------
	// Non-Linux branch: wpsnapshots volume uses www-data
	// -----------------------------------------------------------------------
	it('mounts wpsnapshots under /home/www-data on non-linux', async () => {
		mockOs.platform.mockReturnValue('darwin');
		const fn = makeDockerCompose(null);
		const result = await fn(baseHosts, baseSettings());
		const vols = result.services.phpfpm.volumes;
		expect(vols.some((v) => v.includes(`${SNAPSHOTS_PATH}:/home/www-data/.wpsnapshots`))).toBe(
			true,
		);
	});

	// -----------------------------------------------------------------------
	// Linux branch: custom image, build args, user-scoped volumes
	// -----------------------------------------------------------------------
	it('uses custom image and build args on linux', async () => {
		mockOs.platform.mockReturnValue('linux');
		const savedUser = process.env.USER;
		const savedGetuid = process.getuid;
		process.env.USER = 'devuser';
		process.getuid = () => 1001;

		const fn = makeDockerCompose(null);
		const result = await fn(baseHosts, baseSettings({ php: '8.2' }));

		expect(result.services.phpfpm.image).toBe('wp-php-fpm-dev-8.2-devuser');
		expect(result.services.phpfpm.build.args.CALLING_USER).toBe('devuser');
		expect(result.services.phpfpm.build.args.CALLING_UID).toBe(1001);
		expect(result.services.phpfpm.build.args.PHP_IMAGE).toBe(images['php8.2']);
		expect(
			result.services.phpfpm.volumes.some((v) => v.includes('/home/devuser/.wpsnapshots')),
		).toBe(true);

		process.env.USER = savedUser;
		process.getuid = savedGetuid;
	});

	// -----------------------------------------------------------------------
	// cacheVolume in phpfpm volumes and named volumes section
	// -----------------------------------------------------------------------
	it('includes cacheVolume in phpfpm volumes and top-level volumes', async () => {
		const fn = makeDockerCompose(null);
		const result = await fn(baseHosts, baseSettings());
		expect(result.services.phpfpm.volumes.some((v) => v.startsWith(`${cacheVolume}:`))).toBe(
			true,
		);
		expect(result.volumes[cacheVolume]).toBeDefined();
		expect(result.volumes[cacheVolume].name).toBe(cacheVolume);
	});

	// -----------------------------------------------------------------------
	// dockerCompose filter hook
	// -----------------------------------------------------------------------
	it('applies dockerCompose filter when it is a function and returns a value', async () => {
		const customConfig = { custom: true };
		const settings = baseSettings({
			dockerCompose: jest.fn().mockResolvedValue(customConfig),
		});
		const fn = makeDockerCompose(null);
		const result = await fn(baseHosts, settings);
		expect(result).toEqual({ custom: true });
		expect(settings.dockerCompose).toHaveBeenCalled();
	});

	it('keeps original config when dockerCompose filter returns falsy', async () => {
		const settings = baseSettings({
			dockerCompose: jest.fn().mockResolvedValue(null),
		});
		const fn = makeDockerCompose(null);
		const result = await fn(baseHosts, settings);
		expect(result.services.nginx).toBeDefined();
	});

	// -----------------------------------------------------------------------
	// Spinner path: called with spinner calls start/succeed
	// -----------------------------------------------------------------------
	it('calls spinner.start and spinner.succeed when spinner is provided', async () => {
		const spinner = { start: jest.fn(), succeed: jest.fn() };
		const fn = makeDockerCompose(spinner);
		await fn(baseHosts, baseSettings());
		expect(spinner.start).toHaveBeenCalledTimes(1);
		expect(spinner.succeed).toHaveBeenCalledTimes(1);
	});

	it('does not throw when spinner is null', async () => {
		const fn = makeDockerCompose(null);
		await expect(fn(baseHosts, baseSettings())).resolves.toBeDefined();
	});

	// -----------------------------------------------------------------------
	// Snapshot: full non-linux standard config
	// -----------------------------------------------------------------------
	it('matches snapshot for a standard non-linux environment', async () => {
		mockOs.platform.mockReturnValue('darwin');
		const fn = makeDockerCompose(null);
		const result = await fn(
			['mysite.test'],
			baseSettings({ certs: true, envSlug: 'mysite-test', php: '8.2' }),
		);
		expect(result).toMatchSnapshot();
	});
});
