'use strict';

let mockExecSync;

jest.mock( 'child_process', () => ( {
	execSync: ( ...args ) => mockExecSync( ...args ),
} ) );

const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();

jest.mock( 'fs', () => ( {
	promises: {
		readFile: ( ...args ) => mockReadFile( ...args ),
		writeFile: ( ...args ) => mockWriteFile( ...args ),
	},
} ) );

const mockCreateCert = jest.fn();

jest.mock( 'mkcert', () => ( {
	createCert: ( ...args ) => mockCreateCert( ...args ),
} ) );

jest.mock( 'mkcert-prebuilt', () => '/usr/local/bin/mkcert' );

const mockEnvSlug = jest.fn();

jest.mock( '../../src/env-utils', () => ( {
	envSlug: ( ...args ) => mockEnvSlug( ...args ),
} ) );

const mockGetSslCertsDirectory = jest.fn();

jest.mock( '../../src/configure', () => ( {
	getSslCertsDirectory: ( ...args ) => mockGetSslCertsDirectory( ...args ),
} ) );

const { getCARoot, installCA, generate } = require( '../../src/certificates' );

beforeEach( () => {
	mockExecSync = jest.fn();
} );

describe( 'getCARoot', () => {
	it( 'calls mkcert-prebuilt with -CAROOT and encoding utf-8', () => {
		mockExecSync.mockReturnValue( '/home/user/.local/share/mkcert\n' );

		getCARoot();

		expect( mockExecSync ).toHaveBeenCalledWith(
			'"/usr/local/bin/mkcert" -CAROOT',
			{ encoding: 'utf-8' }
		);
	} );

	it( 'returns the trimmed CAROOT path', () => {
		mockExecSync.mockReturnValue( '  /home/user/.local/share/mkcert\n  ' );

		const result = getCARoot();

		expect( result ).toBe( '/home/user/.local/share/mkcert' );
	} );
} );

describe( 'installCA', () => {
	it( 'calls mkcert-prebuilt with -install', () => {
		mockExecSync.mockReturnValue( undefined );

		installCA();

		expect( mockExecSync ).toHaveBeenCalledWith(
			'"/usr/local/bin/mkcert" -install',
			expect.objectContaining( {} )
		);
	} );

	it( 'uses stdio ignore by default', () => {
		mockExecSync.mockReturnValue( undefined );

		installCA();

		expect( mockExecSync ).toHaveBeenCalledWith(
			expect.any( String ),
			{ stdio: 'ignore' }
		);
	} );

	it( 'uses stdio inherit when verbose=true', () => {
		mockExecSync.mockReturnValue( undefined );

		installCA( true );

		expect( mockExecSync ).toHaveBeenCalledWith(
			expect.any( String ),
			{ stdio: 'inherit' }
		);
	} );

	it( 'returns true on success', () => {
		mockExecSync.mockReturnValue( undefined );

		const result = installCA();

		expect( result ).toBe( true );
	} );

	it( 'returns false when execSync throws', () => {
		mockExecSync.mockImplementation( () => {
			throw new Error( 'mkcert not found' );
		} );

		const result = installCA();

		expect( result ).toBe( false );
	} );

	it( 'returns false without logging when verbose=false and execSync throws', () => {
		mockExecSync.mockImplementation( () => {
			throw new Error( 'mkcert not found' );
		} );
		const consoleSpy = jest.spyOn( console, 'error' ).mockImplementation( () => {} );

		installCA( false );

		expect( consoleSpy ).not.toHaveBeenCalled();
		consoleSpy.mockRestore();
	} );

	it( 'logs the error when verbose=true and execSync throws', () => {
		const err = new Error( 'mkcert not found' );
		mockExecSync.mockImplementation( () => {
			throw err;
		} );
		const consoleSpy = jest.spyOn( console, 'error' ).mockImplementation( () => {} );

		installCA( true );

		expect( consoleSpy ).toHaveBeenCalledWith( err );
		consoleSpy.mockRestore();
	} );
} );

describe( 'generate', () => {
	const caRoot = '/home/user/.local/share/mkcert';

	beforeEach( () => {
		mockExecSync.mockReturnValue( `${ caRoot }\n` );
		mockEnvSlug.mockReturnValue( 'my-env' );
		mockGetSslCertsDirectory.mockResolvedValue( '/etc/ssl/certs/wp' );
		mockReadFile.mockImplementation( ( filePath ) => {
			if ( filePath.endsWith( 'rootCA-key.pem' ) ) {
				return Promise.resolve( '---KEY---' );
			}
			return Promise.resolve( '---CERT---' );
		} );
		mockCreateCert.mockResolvedValue( { cert: 'CERT_CONTENT', key: 'KEY_CONTENT' } );
		mockWriteFile.mockResolvedValue( undefined );
	} );

	it( 'slugifies the envName via envSlug', async () => {
		await generate( 'My Env', [ 'example.com' ] );

		expect( mockEnvSlug ).toHaveBeenCalledWith( 'My Env' );
	} );

	it( 'reads rootCA-key.pem from the CAROOT directory', async () => {
		await generate( 'myenv', [ 'example.com' ] );

		expect( mockReadFile ).toHaveBeenCalledWith(
			`${ caRoot }/rootCA-key.pem`,
			{ encoding: 'utf-8' }
		);
	} );

	it( 'reads rootCA.pem from the CAROOT directory', async () => {
		await generate( 'myenv', [ 'example.com' ] );

		expect( mockReadFile ).toHaveBeenCalledWith(
			`${ caRoot }/rootCA.pem`,
			{ encoding: 'utf-8' }
		);
	} );

	it( 'calls mkcert.createCert with hosts and their wildcards', async () => {
		await generate( 'myenv', [ 'example.com', 'test.local' ] );

		expect( mockCreateCert ).toHaveBeenCalledWith( {
			caCert: '---CERT---',
			caKey: '---KEY---',
			domains: [ 'example.com', 'test.local', '*.example.com', '*.test.local' ],
			validityDays: 365,
		} );
	} );

	it( 'calls mkcert.createCert with caCert and caKey from the read files', async () => {
		mockReadFile.mockImplementation( ( filePath ) => {
			if ( filePath.endsWith( 'rootCA-key.pem' ) ) {
				return Promise.resolve( 'MY_CA_KEY' );
			}
			return Promise.resolve( 'MY_CA_CERT' );
		} );

		await generate( 'myenv', [ 'example.com' ] );

		expect( mockCreateCert ).toHaveBeenCalledWith(
			expect.objectContaining( {
				caCert: 'MY_CA_CERT',
				caKey: 'MY_CA_KEY',
			} )
		);
	} );

	it( 'writes the cert file to sslDir/<slug>.crt', async () => {
		await generate( 'myenv', [ 'example.com' ] );

		expect( mockWriteFile ).toHaveBeenCalledWith(
			'/etc/ssl/certs/wp/my-env.crt',
			'CERT_CONTENT'
		);
	} );

	it( 'writes the key file to sslDir/<slug>.key', async () => {
		await generate( 'myenv', [ 'example.com' ] );

		expect( mockWriteFile ).toHaveBeenCalledWith(
			'/etc/ssl/certs/wp/my-env.key',
			'KEY_CONTENT'
		);
	} );

	it( 'returns the cert and key file paths', async () => {
		const result = await generate( 'myenv', [ 'example.com' ] );

		expect( result ).toEqual( {
			cert: '/etc/ssl/certs/wp/my-env.crt',
			key: '/etc/ssl/certs/wp/my-env.key',
		} );
	} );
} );
