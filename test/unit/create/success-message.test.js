const makeSuccessMessage = require('../../../src/commands/create/success-message');

const wordpress = {
	title: 'x.test',
	username: 'admin',
	password: 'password',
	email: 'admin@example.com',
	type: 'single',
};

describe('makeSuccessMessage', () => {
	it('shows the admin credentials in quick mode', () => {
		const { info } = makeSuccessMessage({ domain: 'x.test', certs: true, wordpress }, true);
		expect(info).toContain('admin');
		expect(info).toContain('password');
		expect(info).toMatch(/Admin login: admin \/ password/);
	});

	it('has no credentials line in interactive mode', () => {
		const { info } = makeSuccessMessage({ domain: 'x.test', certs: true, wordpress }, false);
		expect(info).not.toMatch(/Admin login/);
		expect(info).not.toContain('password');
	});

	it('has no credentials line when WordPress is not installed', () => {
		const { info } = makeSuccessMessage({ domain: 'x.test', wordpress: false }, true);
		expect(info).not.toMatch(/Admin login/);
	});

	it('lists https homepage and admin URLs for every host when certs exist', () => {
		const { info } = makeSuccessMessage({
			domain: ['a.test', 'b.test'],
			certs: true,
			wordpress,
		});
		['a.test', 'b.test'].forEach((host) => {
			expect(info).toContain(`Homepage: https://${host}/`);
			expect(info).toContain(`WP admin: https://${host}/wp-admin/`);
		});
	});

	it('uses http when there are no certs', () => {
		const { info } = makeSuccessMessage({ domain: 'x.test', certs: false, wordpress });
		expect(info).toContain('Homepage: http://x.test/');
		expect(info).toContain('WP admin: http://x.test/wp-admin/');
		expect(info).not.toContain('https://');
	});

	it('returns a link map with the homepage and admin URLs', () => {
		const { links } = makeSuccessMessage({ domain: 'x.test', certs: true, wordpress });
		expect(links).toEqual({
			'https://x.test/': 'https://x.test/',
			'https://x.test/wp-admin/': 'https://x.test/wp-admin/',
		});
	});
});
