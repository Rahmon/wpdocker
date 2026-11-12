const inquirer = require('inquirer');
const fsExtra = require('fs-extra');
const sudo = require('@vscode/sudo-prompt');
const which = require('which');

const { startGlobal } = require('../gateway');
const environment = require('../environment');
const envUtils = require('../env-utils');

const makeSpinner = require('../utils/make-spinner');
const makeCommand = require('../utils/make-command');
const makeBoxen = require('../utils/make-boxen');
const displayError = require('../utils/display-error');
const { replaceLinks } = require('../utils/make-link');

const makeInquirer = require('./create/inquirer');
const makeDockerCompose = require('./create/make-docker-compose');
const makeFs = require('./create/make-fs');
const makeSaveYamlFile = require('./create/save-yaml-file');
const makeCopyConfigs = require('./create/copy-configs');
const makeDatabase = require('./create/create-database');
const makeInstallWordPress = require('./create/install-wordpress');
const makeSaveJsonFile = require('./create/save-json-file');
const makeUpdateHosts = require('./create/update-hosts');
const makeCert = require('./create/make-cert');
const makeSuccessMessage = require('./create/success-message');

/**
 * Create an environment.
 *
 * @param {object} spinner Spinner instance (undefined in verbose mode).
 * @param {object} defaults Pre-filled answers for the interactive prompter.
 * @param {object|null} prebuiltSettings Settings to use instead of prompting (quick create).
 * @returns {Promise<object>} The resulting environment settings.
 */
async function createCommand(spinner, defaults = {}, prebuiltSettings = null) {
	const answers = prebuiltSettings || (await makeInquirer(inquirer)(defaults));
	await envUtils.checkForEOLPHP(answers.php);

	const settings = {
		...answers,
		envSlug: '',
		paths: {},
		certs: {},
	};

	const hostname = Array.isArray(settings.domain) ? settings.domain[0] : settings.domain;
	const envHosts = Array.isArray(settings.domain) ? settings.domain : [settings.domain];

	settings.envSlug = envUtils.envSlug(hostname);
	settings.paths = await makeFs(spinner)(hostname);
	const saveYaml = makeSaveYamlFile(settings['paths']['/']);
	settings.certs = await makeCert(spinner)(settings.envSlug, envHosts);

	const dockerComposer = await makeDockerCompose(spinner)(envHosts, settings);
	await saveYaml('docker-compose.yml', dockerComposer);
	await saveYaml('wp-cli.yml', { ssh: 'docker-compose:phpfpm' });

	await makeCopyConfigs(spinner, fsExtra)(settings);

	await startGlobal(spinner);
	await makeDatabase(spinner)(settings.envSlug);
	await environment.start(settings.envSlug, spinner);

	await makeInstallWordPress(spinner)(hostname, settings);

	await makeSaveJsonFile(settings['paths']['/'])('.config.json', {
		envHosts,
		certs: settings['certs'],
	});
	await makeUpdateHosts(which, sudo, spinner)(envHosts);

	return settings;
}

exports.command = 'create [hostname]';
exports.desc = 'Create a new docker environment.';
exports.aliases = ['new'];

exports.builder = function (yargs) {
	yargs.positional('hostname', {
		type: 'string',
		describe:
			'Optional. Hostname for a quick create using the default settings, without prompts.',
	});
};

const runCreate = makeCommand(async ({ verbose }, quickSettings) => {
	const spinner = !verbose ? makeSpinner() : undefined;
	const answers = await createCommand(spinner, {}, quickSettings);

	if (spinner && !!answers.wordpress && answers.wordpress.type === 'subdomain') {
		spinner.info(
			'Note: Subdomain multisites require any additional subdomains to be added manually to your hosts file!',
		);
	}

	const { info, links } = makeSuccessMessage(answers, !!quickSettings);

	console.log(replaceLinks(makeBoxen()(info), links));
});

exports.handler = (argv) => {
	let quickSettings = null;

	// Validate the hostname before the Docker check and before any filesystem work.
	if (argv.hostname !== undefined) {
		try {
			quickSettings = makeInquirer.buildQuickSettings(argv.hostname);
		} catch (err) {
			displayError(err.message);
			return undefined;
		}
	}

	return runCreate(argv, quickSettings);
};

exports.createCommand = createCommand;
