const { EOL } = require('os');

/**
 * Build the text shown in the success box after an environment is created.
 *
 * @param {object} settings The resulting environment settings.
 * @param {boolean} quick Whether the environment was created with quick create.
 * @returns {{ info: string, links: object }} The message text and its link map.
 */
module.exports = function makeSuccessMessage(settings, quick = false) {
	let info = `Successfully Created Site!${EOL}${EOL}`;
	const links = {};
	const http = settings.certs ? 'https' : 'http';

	(Array.isArray(settings.domain) ? settings.domain : [settings.domain]).forEach((host) => {
		const home = `${http}://${host}/`;
		const admin = `${http}://${host}/wp-admin/`;

		links[home] = home;
		links[admin] = admin;

		info += `Homepage: ${home}${EOL}`;
		info += `WP admin: ${admin}${EOL}`;
		info += EOL;
	});

	// Quick create users never saw the credentials, so show them.
	if (quick && settings.wordpress) {
		const { username, password } = settings.wordpress;
		info += `Admin login: ${username} / ${password}${EOL}`;
	}

	return { info, links };
};
