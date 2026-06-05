'use strict';

const path = require( 'path' );

jest.mock( 'os', () => ( {
	...jest.requireActual( 'os' ),
	homedir: () => '/fake/home',
} ) );

const {
	createProxyConfig,
	getDefaults,
	getConfigDirectory,
	getGlobalDirectory,
} = require( '../../src/configure' );

describe( 'getConfigDirectory', () => {
	it( 'returns .wplocaldocker inside the home directory', () => {
		expect( getConfigDirectory() ).toBe( path.join( '/fake/home', '.wplocaldocker' ) );
	} );
} );

describe( 'getGlobalDirectory', () => {
	it( 'returns global/ inside the config directory', () => {
		expect( getGlobalDirectory() ).toBe( path.join( '/fake/home', '.wplocaldocker', 'global' ) );
	} );
} );

describe( 'getDefaults', () => {
	it( 'sitesPath is inside the home directory', () => {
		expect( getDefaults().sitesPath ).toBe( path.join( '/fake/home', 'wp-local-docker-sites' ) );
	} );

	it( 'snapshotsPath is inside the home directory', () => {
		expect( getDefaults().snapshotsPath ).toBe( path.join( '/fake/home', '.wpsnapshots' ) );
	} );

	it( 'manageHosts defaults to true', () => {
		expect( getDefaults().manageHosts ).toBe( true );
	} );

	it( 'overwriteGlobal defaults to true', () => {
		expect( getDefaults().overwriteGlobal ).toBe( true );
	} );
} );

describe( 'createProxyConfig', () => {
	it( 'replaces #{TRY_PROXY} with the try_files directive', () => {
		const result = createProxyConfig( 'https://example.com', '#{TRY_PROXY}' );
		expect( result ).toBe( 'try_files $uri @production;' );
	} );

	it( 'replaces #{PROXY_URL} with a location block', () => {
		const result = createProxyConfig( 'https://example.com', '#{PROXY_URL}' );
		expect( result ).toContain( 'location @production {' );
		expect( result ).toContain( '}' );
	} );

	it( 'injects the proxy URL into the proxy_pass directive', () => {
		const result = createProxyConfig( 'https://example.com', '#{PROXY_URL}' );
		expect( result ).toContain( 'proxy_pass https://example.com/$uri;' );
	} );

	it( 'replaces both placeholders in the same config string', () => {
		const input = 'before #{TRY_PROXY} middle #{PROXY_URL} after';
		const result = createProxyConfig( 'https://example.com', input );
		expect( result ).toContain( 'try_files $uri @production;' );
		expect( result ).toContain( 'location @production {' );
		expect( result ).toContain( 'after' );
	} );

	it( 'leaves a string without placeholders unchanged', () => {
		const input = 'server { listen 80; }';
		expect( createProxyConfig( 'https://example.com', input ) ).toBe( input );
	} );

	it( 'uses different proxy URLs in the generated block', () => {
		const result = createProxyConfig( 'https://staging.example.com', '#{PROXY_URL}' );
		expect( result ).toContain( 'proxy_pass https://staging.example.com/$uri;' );
	} );
} );
