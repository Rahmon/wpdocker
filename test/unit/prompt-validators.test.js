'use strict';

const { validateNotEmpty, validateBool, parseHostname, parseProxyUrl } = require( '../../src/prompt-validators' );

describe( 'validateNotEmpty', () => {
	it( 'returns true for a non-empty string', () => {
		expect( validateNotEmpty( 'hello' ) ).toBe( true );
	} );

	it( 'returns an error message for an empty string', () => {
		expect( validateNotEmpty( '' ) ).toBe( 'This field is required' );
	} );

	it( 'returns an error message for a whitespace-only string', () => {
		expect( validateNotEmpty( '   ' ) ).toBe( 'This field is required' );
	} );

	it( 'returns true for a string with leading/trailing whitespace around content', () => {
		expect( validateNotEmpty( '  hello  ' ) ).toBe( true );
	} );
} );

describe( 'validateBool', () => {
	it( 'returns "true" for "y"', () => {
		expect( validateBool( 'y' ) ).toBe( 'true' );
	} );

	it( 'returns "true" for "Y" (case-insensitive)', () => {
		expect( validateBool( 'Y' ) ).toBe( 'true' );
	} );

	it( 'returns "true" for "yes"', () => {
		expect( validateBool( 'yes' ) ).toBe( 'true' );
	} );

	it( 'returns "true" for "YES" (case-insensitive)', () => {
		expect( validateBool( 'YES' ) ).toBe( 'true' );
	} );

	it( 'returns "false" for "n"', () => {
		expect( validateBool( 'n' ) ).toBe( 'false' );
	} );

	it( 'returns "false" for "no"', () => {
		expect( validateBool( 'no' ) ).toBe( 'false' );
	} );

	it( 'returns "false" for "NO" (case-insensitive)', () => {
		expect( validateBool( 'NO' ) ).toBe( 'false' );
	} );

	it( 'returns the original string for an unrecognized value', () => {
		expect( validateBool( 'maybe' ) ).toBe( 'maybe' );
	} );

	it( 'passes through a non-string value unchanged', () => {
		expect( validateBool( true ) ).toBe( true );
	} );

	it( 'passes through a numeric value unchanged', () => {
		expect( validateBool( 42 ) ).toBe( 42 );
	} );
} );

describe( 'parseHostname', () => {
	it( 'strips an http:// prefix', () => {
		expect( parseHostname( 'http://example.com' ) ).toBe( 'example.com' );
	} );

	it( 'strips an https:// prefix', () => {
		expect( parseHostname( 'https://example.com' ) ).toBe( 'example.com' );
	} );

	it( 'strips an HTTP:// prefix (case-insensitive)', () => {
		expect( parseHostname( 'HTTP://example.com' ) ).toBe( 'example.com' );
	} );

	it( 'removes a path component, keeping only the hostname', () => {
		expect( parseHostname( 'example.com/some/path' ) ).toBe( 'example.com' );
	} );

	it( 'removes both protocol and path', () => {
		expect( parseHostname( 'https://example.com/some/path' ) ).toBe( 'example.com' );
	} );

	it( 'removes spaces from the value', () => {
		expect( parseHostname( 'example .com' ) ).toBe( 'example.com' );
	} );

	it( 'returns a plain hostname unchanged', () => {
		expect( parseHostname( 'example.com' ) ).toBe( 'example.com' );
	} );
} );

describe( 'parseProxyUrl', () => {
	it( 'adds http:// when no protocol is present and value is longer than 3 chars', () => {
		expect( parseProxyUrl( 'example.com' ) ).toBe( 'http://example.com' );
	} );

	it( 'does not add a protocol when one is already present (http)', () => {
		expect( parseProxyUrl( 'http://example.com' ) ).toBe( 'http://example.com' );
	} );

	it( 'does not add a protocol when one is already present (https)', () => {
		expect( parseProxyUrl( 'https://example.com' ) ).toBe( 'https://example.com' );
	} );

	it( 'does not modify a value with length <= 3', () => {
		expect( parseProxyUrl( 'foo' ) ).toBe( 'foo' );
	} );

	it( 'removes a trailing slash', () => {
		expect( parseProxyUrl( 'http://example.com/' ) ).toBe( 'http://example.com' );
	} );

	it( 'adds protocol and removes trailing slash together', () => {
		expect( parseProxyUrl( 'example.com/' ) ).toBe( 'http://example.com' );
	} );
} );
