'use strict';

const mockCompose = {
	down: jest.fn(),
	upAll: jest.fn(),
	pullAll: jest.fn(),
	isRunning: jest.fn(),
};

const mockGateway = {
	startGlobal: jest.fn(),
	stopGlobal: jest.fn(),
	restartGlobal: jest.fn(),
};

const mockDatabase = {
	deleteDatabase: jest.fn(),
};

const mockEnvUtils = {
	getPathOrError: jest.fn(),
	envSlug: jest.fn(),
	getEnvHosts: jest.fn(),
	getAllEnvironments: jest.fn(),
};

const mockConfig = {
	get: jest.fn(),
	getSslCertsDirectory: jest.fn(),
};

const mockFsExtra = {
	remove: jest.fn(),
};

const mockInquirer = {
	prompt: jest.fn(),
};

const mockWhich = jest.fn();
const mockSudo = { exec: jest.fn() };

jest.mock('../../src/configure', () => mockConfig);
jest.mock('../../src/database', () => mockDatabase);
jest.mock('../../src/env-utils', () => mockEnvUtils);
jest.mock('../../src/gateway', () => mockGateway);
jest.mock('../../src/utils/docker-compose', () => mockCompose);
jest.mock('fs-extra', () => mockFsExtra);
jest.mock('inquirer', () => mockInquirer);
jest.mock('which', () => mockWhich);
jest.mock('@vscode/sudo-prompt', () => mockSudo);

const environment = require('../../src/environment');

function makeSpinner() {
	return {
		start: jest.fn(),
		succeed: jest.fn(),
		warn: jest.fn(),
	};
}

const ENV_NAME = 'mysite-test';
const ENV_PATH = '/sites/mysite-test';
const ENV_SLUG = 'mysite-test';
const ENV_HOSTS = ['mysite.test', 'www.mysite.test'];
const SSL_DIR = '/home/user/.wplocaldocker/global/ssl-certs';

beforeEach(() => {
	mockEnvUtils.getPathOrError.mockResolvedValue(ENV_PATH);
	mockEnvUtils.envSlug.mockReturnValue(ENV_SLUG);
	mockEnvUtils.getEnvHosts.mockResolvedValue(ENV_HOSTS);
	mockEnvUtils.getAllEnvironments.mockResolvedValue([ENV_NAME]);
	mockGateway.startGlobal.mockResolvedValue();
	mockGateway.stopGlobal.mockResolvedValue();
	mockGateway.restartGlobal.mockResolvedValue();
	mockCompose.upAll.mockResolvedValue();
	mockCompose.down.mockResolvedValue();
	mockCompose.pullAll.mockResolvedValue();
	mockCompose.isRunning.mockResolvedValue(false);
	mockDatabase.deleteDatabase.mockResolvedValue();
	mockFsExtra.remove.mockResolvedValue();
	mockConfig.getSslCertsDirectory.mockResolvedValue(SSL_DIR);
	mockConfig.get.mockResolvedValue(false);
	mockInquirer.prompt.mockResolvedValue({ confirm: true });
	mockWhich.mockResolvedValue('/usr/local/bin/node');
	mockSudo.exec.mockImplementation((cmd, opts, cb) => cb(null, 'ok'));
});

describe('environment', () => {
	describe('start', () => {
		it('calls startGlobal and upAll without pulling when pull=false', async () => {
			const spinner = makeSpinner();
			await environment.start(ENV_NAME, spinner, false);

			expect(mockEnvUtils.getPathOrError).toHaveBeenCalledWith(ENV_NAME, spinner);
			expect(mockGateway.startGlobal).toHaveBeenCalledWith(spinner, false);
			expect(mockCompose.pullAll).not.toHaveBeenCalled();
			expect(mockCompose.upAll).toHaveBeenCalledWith({ cwd: ENV_PATH, log: false });
		});

		it('pulls images before upAll when pull=true', async () => {
			const spinner = makeSpinner();
			await environment.start(ENV_NAME, spinner, true);

			expect(mockCompose.pullAll).toHaveBeenCalledWith({ cwd: ENV_PATH, log: false });
			expect(mockCompose.upAll).toHaveBeenCalledWith({ cwd: ENV_PATH, log: false });
		});

		it('sets log=true when no spinner is provided', async () => {
			await environment.start(ENV_NAME, null, false);

			expect(mockCompose.upAll).toHaveBeenCalledWith({ cwd: ENV_PATH, log: true });
		});

		it('calls spinner.start and spinner.succeed', async () => {
			const spinner = makeSpinner();
			await environment.start(ENV_NAME, spinner, false);

			expect(spinner.start).toHaveBeenCalled();
			expect(spinner.succeed).toHaveBeenCalled();
		});
	});

	describe('stop', () => {
		it('calls compose.down with the env cwd', async () => {
			const spinner = makeSpinner();
			await environment.stop(ENV_NAME, spinner);

			expect(mockEnvUtils.getPathOrError).toHaveBeenCalledWith(ENV_NAME, spinner);
			expect(mockCompose.down).toHaveBeenCalledWith({ cwd: ENV_PATH, log: false });
		});

		it('sets log=true when no spinner is provided', async () => {
			await environment.stop(ENV_NAME, null);

			expect(mockCompose.down).toHaveBeenCalledWith({ cwd: ENV_PATH, log: true });
		});
	});

	describe('restart', () => {
		it('calls compose.down before upAll when isRunning=true', async () => {
			mockCompose.isRunning.mockResolvedValue(true);
			const callOrder = [];
			mockCompose.down.mockImplementation(() => {
				callOrder.push('down');
				return Promise.resolve();
			});
			mockCompose.upAll.mockImplementation(() => {
				callOrder.push('upAll');
				return Promise.resolve();
			});
			const spinner = makeSpinner();

			await environment.restart(ENV_NAME, spinner);

			expect(callOrder).toEqual(['down', 'upAll']);
		});

		it('skips compose.down when isRunning=false', async () => {
			mockCompose.isRunning.mockResolvedValue(false);
			const spinner = makeSpinner();
			await environment.restart(ENV_NAME, spinner);

			expect(mockCompose.down).not.toHaveBeenCalled();
			expect(mockCompose.upAll).toHaveBeenCalled();
		});

		it('calls startGlobal and then upAll', async () => {
			const spinner = makeSpinner();
			await environment.restart(ENV_NAME, spinner);

			expect(mockGateway.startGlobal).toHaveBeenCalledWith(spinner);
			expect(mockCompose.upAll).toHaveBeenCalledWith({ cwd: ENV_PATH, log: false });
		});
	});

	describe('deleteEnv', () => {
		it('returns early without removing anything when confirm=false', async () => {
			mockInquirer.prompt.mockResolvedValue({ confirm: false });
			const spinner = makeSpinner();
			await environment.deleteEnv(ENV_NAME, spinner);

			expect(mockFsExtra.remove).not.toHaveBeenCalled();
			expect(mockDatabase.deleteDatabase).not.toHaveBeenCalled();
		});

		it('removes env directory, certificates, and database when confirm=true', async () => {
			mockInquirer.prompt.mockResolvedValue({ confirm: true });
			const spinner = makeSpinner();
			await environment.deleteEnv(ENV_NAME, spinner);

			expect(mockFsExtra.remove).toHaveBeenCalledWith(ENV_PATH);
			expect(mockFsExtra.remove).toHaveBeenCalledWith(`${SSL_DIR}/${ENV_SLUG}.crt`);
			expect(mockFsExtra.remove).toHaveBeenCalledWith(`${SSL_DIR}/${ENV_SLUG}.key`);
			expect(mockDatabase.deleteDatabase).toHaveBeenCalledWith(ENV_SLUG);
		});

		it('calls compose.down with -v commandOptions', async () => {
			mockInquirer.prompt.mockResolvedValue({ confirm: true });
			await environment.deleteEnv(ENV_NAME, null);

			expect(mockCompose.down).toHaveBeenCalledWith({
				cwd: ENV_PATH,
				log: true,
				commandOptions: ['-v'],
			});
		});

		it('calls getSslCertsDirectory with false to skip dir creation', async () => {
			mockInquirer.prompt.mockResolvedValue({ confirm: true });
			await environment.deleteEnv(ENV_NAME, null);

			expect(mockConfig.getSslCertsDirectory).toHaveBeenCalledWith(false);
		});

		it('calls sudo.exec to remove host entries when manageHosts=true', async () => {
			mockConfig.get.mockResolvedValue(true);
			mockInquirer.prompt.mockResolvedValue({ confirm: true });
			const spinner = makeSpinner();
			await environment.deleteEnv(ENV_NAME, spinner);

			expect(mockWhich).toHaveBeenCalledWith('node');
			expect(mockSudo.exec).toHaveBeenCalled();
		});

		it('does not call sudo.exec when manageHosts=false', async () => {
			mockConfig.get.mockResolvedValue(false);
			mockInquirer.prompt.mockResolvedValue({ confirm: true });
			await environment.deleteEnv(ENV_NAME, null);

			expect(mockSudo.exec).not.toHaveBeenCalled();
		});

		it('calls spinner.warn when sudo.exec callback receives an error', async () => {
			mockConfig.get.mockResolvedValue(true);
			mockInquirer.prompt.mockResolvedValue({ confirm: true });
			mockSudo.exec.mockImplementation((cmd, opts, cb) => cb(new Error('sudo failed')));
			const spinner = makeSpinner();
			await environment.deleteEnv(ENV_NAME, spinner);

			expect(spinner.warn).toHaveBeenCalled();
		});
	});

	describe('startAll', () => {
		it('calls startGlobal once up-front and start for each environment', async () => {
			mockEnvUtils.getAllEnvironments.mockResolvedValue(['site-a', 'site-b']);
			const spinner = makeSpinner();
			await environment.startAll(spinner, false);

			expect(mockEnvUtils.getAllEnvironments).toHaveBeenCalled();
			// startGlobal: 1 from startAll + 1 per start() call = 3 total
			expect(mockGateway.startGlobal).toHaveBeenCalledTimes(3);
			expect(mockCompose.upAll).toHaveBeenCalledTimes(2);
		});
	});

	describe('stopAll', () => {
		it('stops each environment then calls stopGlobal', async () => {
			mockEnvUtils.getAllEnvironments.mockResolvedValue(['site-a', 'site-b']);
			const spinner = makeSpinner();
			await environment.stopAll(spinner);

			expect(mockCompose.down).toHaveBeenCalledTimes(2);
			expect(mockGateway.stopGlobal).toHaveBeenCalledWith(spinner);
		});
	});

	describe('restartAll', () => {
		it('restarts each environment then calls restartGlobal', async () => {
			mockEnvUtils.getAllEnvironments.mockResolvedValue(['site-a', 'site-b']);
			const spinner = makeSpinner();
			await environment.restartAll(spinner);

			expect(mockCompose.upAll).toHaveBeenCalledTimes(2);
			expect(mockGateway.restartGlobal).toHaveBeenCalledWith(spinner);
		});
	});

	describe('deleteAll', () => {
		it('calls deleteEnv for each environment', async () => {
			mockEnvUtils.getAllEnvironments.mockResolvedValue(['site-a', 'site-b']);
			mockInquirer.prompt.mockResolvedValue({ confirm: false });
			const spinner = makeSpinner();
			await environment.deleteAll(spinner);

			expect(mockEnvUtils.getAllEnvironments).toHaveBeenCalled();
			expect(mockInquirer.prompt).toHaveBeenCalledTimes(2);
		});
	});
});
