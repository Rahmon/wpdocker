'use strict';

const mockCompose = {
	down: jest.fn(),
	exec: jest.fn(),
	logs: jest.fn(),
	ps: jest.fn(),
	pullAll: jest.fn(),
	restartAll: jest.fn(),
	run: jest.fn(),
	upAll: jest.fn(),
	port: jest.fn(),
};

jest.mock( 'docker-compose', () => mockCompose );

const dc = require( '../../../src/utils/docker-compose' );

function resolvesWith( out ) {
	return Promise.resolve( { out, err: '', exitCode: 0 } );
}

function rejectsWith( err ) {
	return Promise.resolve( { out: '', err, exitCode: 1 } );
}

const PROXIED_METHODS = [ 'down', 'exec', 'logs', 'ps', 'pullAll', 'restartAll', 'run', 'upAll' ];

describe( 'docker-compose wrapper', () => {
	describe( 'proxied methods forward args and return out', () => {
		PROXIED_METHODS.forEach( ( method ) => {
			it( `${ method } forwards args and resolves with out`, async () => {
				mockCompose[ method ].mockReturnValue( resolvesWith( `${ method } output` ) );

				const result = await dc[ method ]( 'arg1', 'arg2' );

				expect( mockCompose[ method ] ).toHaveBeenCalledWith( 'arg1', 'arg2' );
				expect( result ).toBe( `${ method } output` );
			} );
		} );
	} );

	describe( 'proxied methods throw when exitCode is truthy', () => {
		PROXIED_METHODS.forEach( ( method ) => {
			it( `${ method } throws the err string on non-zero exitCode`, async () => {
				mockCompose[ method ].mockReturnValue( rejectsWith( `${ method } failed` ) );

				await expect( dc[ method ]() ).rejects.toThrow( `${ method } failed` );
			} );
		} );
	} );

	describe( 'isRunning', () => {
		it( 'returns true when compose.port resolves', async () => {
			mockCompose.port.mockResolvedValue( {} );

			const result = await dc.isRunning( '/some/cwd' );

			expect( result ).toBe( true );
			expect( mockCompose.port ).toHaveBeenCalledWith( 'nginx', 80, { cwd: '/some/cwd' } );
		} );

		it( 'returns false when compose.port rejects', async () => {
			mockCompose.port.mockRejectedValue( new Error( 'not running' ) );

			const result = await dc.isRunning( '/some/cwd' );

			expect( result ).toBe( false );
		} );
	} );
} );
