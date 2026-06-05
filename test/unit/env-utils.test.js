'use strict';

const { envSlug, createDefaultProxy } = require( '../../src/env-utils' );

describe( 'envSlug', () => {
	it( 'returns a plain lowercase word unchanged', () => {
		expect( envSlug( 'mysite' ) ).toBe( 'mysite' );
	} );

	it( 'converts spaces to hyphens', () => {
		expect( envSlug( 'hello world' ) ).toBe( 'hello-world' );
	} );

	it( 'lowercases uppercase input', () => {
		expect( envSlug( 'MySite' ) ).toBe( 'my-site' );
	} );

	it( 'converts dots to hyphens', () => {
		expect( envSlug( 'my.site.com' ) ).toBe( 'my-site-com' );
	} );

	it( 'converts underscores to hyphens', () => {
		expect( envSlug( 'test_env' ) ).toBe( 'test-env' );
	} );

	it( 'strips leading and trailing spaces', () => {
		expect( envSlug( '  leading spaces  ' ) ).toBe( 'leading-spaces' );
	} );

	it( 'preserves already-slugified input', () => {
		expect( envSlug( 'hello-world' ) ).toBe( 'hello-world' );
	} );
} );

describe( 'createDefaultProxy', () => {
	it( 'prepends http:// to a plain hostname', () => {
		expect( createDefaultProxy( 'example.com' ) ).toBe( 'http://example.com' );
	} );

	it( 'replaces a non-com TLD with com', () => {
		expect( createDefaultProxy( 'example.net' ) ).toBe( 'http://example.com' );
	} );

	it( 'appends .com when there is no dot in the hostname', () => {
		expect( createDefaultProxy( 'example' ) ).toBe( 'http://example.com' );
	} );

	it( 'replaces only the last TLD segment for a subdomain', () => {
		expect( createDefaultProxy( 'sub.example.net' ) ).toBe( 'http://sub.example.com' );
	} );

	it( 'strips a trailing slash from the value', () => {
		expect( createDefaultProxy( 'example.com/' ) ).toBe( 'http://example.com' );
	} );

	it( 'strips leading and trailing slashes from the value', () => {
		expect( createDefaultProxy( '/example.com/' ) ).toBe( 'http://example.com' );
	} );
} );
