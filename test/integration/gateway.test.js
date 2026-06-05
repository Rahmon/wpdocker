'use strict';

const EventEmitter = require( 'events' );

// Tracks nc instances created; tests can assert on them or emit 'data' to resolve waitForDB
let mockNcInstances = [];

// Each nc instance's connect() fires 'data' after the listener is registered
// (setImmediate ensures the on('data') call happens first)
function mockMakeNc() {
	const inst = new EventEmitter();
	inst.address = jest.fn();
	inst.port = jest.fn();
	inst.connect = jest.fn().mockImplementation( () => {
		setImmediate( () => inst.emit( 'data' ) );
	} );
	inst.close = jest.fn();
	mockNcInstances.push( inst );
	return inst;
}

const mockCompose = {
	upAll: jest.fn(),
	down: jest.fn(),
	pullAll: jest.fn(),
	restartAll: jest.fn(),
};

const mockConfig = {
	getConfigDirectory: jest.fn(),
};

const mockEnvUtils = {
	globalPath: '/home/user/.wplocaldocker/global',
	cacheVolume: 'wplocaldockerCache',
};

jest.mock( '../../src/utils/docker-compose', () => mockCompose );
jest.mock( '../../src/configure', () => mockConfig );
jest.mock( '../../src/env-utils', () => mockEnvUtils );
jest.mock( 'fs', () => ( { existsSync: jest.fn( () => false ) } ) );
jest.mock( 'netcat/client', () => jest.fn( () => mockMakeNc() ) );
// make-docker is mocked via a var so we can swap mockDocker per test
jest.mock( '../../src/utils/make-docker', () => () => mockDocker ); // eslint-disable-line no-undef

function makeDockerMock() {
	const network = {
		inspect: jest.fn(),
		remove: jest.fn(),
	};
	const volume = {
		inspect: jest.fn(),
		remove: jest.fn(),
	};
	return {
		_network: network,
		_volume: volume,
		getNetwork: jest.fn( () => network ),
		getVolume: jest.fn( () => volume ),
		createNetwork: jest.fn(),
		createVolume: jest.fn(),
	};
}

// var so the jest.mock factory above (hoisted) can reference it
// eslint-disable-next-line no-var
var mockDocker; // eslint-disable-line vars-on-top

function makeSpinner() {
	return {
		start: jest.fn(),
		succeed: jest.fn(),
		warn: jest.fn(),
	};
}

beforeEach( () => {
	mockDocker = makeDockerMock();
	mockNcInstances = [];
	mockCompose.upAll.mockResolvedValue();
	mockCompose.down.mockResolvedValue();
	mockCompose.pullAll.mockResolvedValue();
	mockCompose.restartAll.mockResolvedValue();
	mockConfig.getConfigDirectory.mockReturnValue( '/home/user/.wplocaldocker' );
} );

// Gateway has module-level `started` flag; reload per test to reset it.
function loadGateway() {
	jest.resetModules();
	jest.mock( '../../src/utils/make-docker', () => () => mockDocker );
	jest.mock( '../../src/utils/docker-compose', () => mockCompose );
	jest.mock( '../../src/configure', () => mockConfig );
	jest.mock( '../../src/env-utils', () => mockEnvUtils );
	jest.mock( 'fs', () => ( { existsSync: jest.fn( () => false ) } ) );
	jest.mock( 'netcat/client', () => jest.fn( () => mockMakeNc() ) );
	return require( '../../src/gateway' );
}

describe( 'gateway', () => {
	describe( 'ensureNetworkExists', () => {
		it( 'does nothing when the network already exists', async () => {
			const gateway = loadGateway();
			mockDocker._network.inspect.mockResolvedValue( { Id: 'abc' } );

			await gateway.ensureNetworkExists( mockDocker, makeSpinner() );

			expect( mockDocker.createNetwork ).not.toHaveBeenCalled();
		} );

		it( 'creates the network when inspect rejects', async () => {
			const gateway = loadGateway();
			mockDocker._network.inspect.mockRejectedValue( new Error( 'not found' ) );
			mockDocker.createNetwork.mockResolvedValue();

			await gateway.ensureNetworkExists( mockDocker, makeSpinner() );

			expect( mockDocker.createNetwork ).toHaveBeenCalledWith(
				expect.objectContaining( { Name: 'wplocaldocker' } )
			);
		} );

		it( 'logs to console when no spinner is provided', async () => {
			const gateway = loadGateway();
			mockDocker._network.inspect.mockResolvedValue( { Id: 'abc' } );
			const spy = jest.spyOn( console, 'log' ).mockImplementation( () => {} );

			await gateway.ensureNetworkExists( mockDocker, null );

			expect( spy ).toHaveBeenCalled();
			spy.mockRestore();
		} );
	} );

	describe( 'ensureCacheExists', () => {
		it( 'does nothing when the volume already exists', async () => {
			const gateway = loadGateway();
			mockDocker._volume.inspect.mockResolvedValue( { Name: mockEnvUtils.cacheVolume } );

			await gateway.ensureCacheExists( mockDocker, makeSpinner() );

			expect( mockDocker.createVolume ).not.toHaveBeenCalled();
		} );

		it( 'creates the volume when inspect rejects', async () => {
			const gateway = loadGateway();
			mockDocker._volume.inspect.mockRejectedValue( new Error( 'not found' ) );
			mockDocker.createVolume.mockResolvedValue();

			await gateway.ensureCacheExists( mockDocker, makeSpinner() );

			expect( mockDocker.createVolume ).toHaveBeenCalledWith(
				expect.objectContaining( { Name: mockEnvUtils.cacheVolume } )
			);
		} );
	} );

	describe( 'removeCacheVolume', () => {
		it( 'removes the volume when it exists', async () => {
			const gateway = loadGateway();
			mockDocker._volume.inspect.mockResolvedValue( { Name: mockEnvUtils.cacheVolume } );
			mockDocker._volume.remove.mockResolvedValue();

			await gateway.removeCacheVolume( mockDocker, makeSpinner() );

			expect( mockDocker._volume.remove ).toHaveBeenCalled();
		} );

		it( 'skips removal when the volume does not exist', async () => {
			const gateway = loadGateway();
			mockDocker._volume.inspect.mockRejectedValue( new Error( 'not found' ) );

			await gateway.removeCacheVolume( mockDocker, makeSpinner() );

			expect( mockDocker._volume.remove ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'startGlobal', () => {
		beforeEach( () => {
			jest.useFakeTimers();
		} );

		afterEach( () => {
			jest.useRealTimers();
		} );

		it( 'calls getNetwork, getVolume and compose.upAll', async () => {
			const gateway = loadGateway();
			mockDocker._network.inspect.mockResolvedValue( {} );
			mockDocker._volume.inspect.mockResolvedValue( {} );

			const p = gateway.startGlobal( makeSpinner(), false );
			await jest.runAllTimersAsync();
			await p;

			expect( mockDocker.getNetwork ).toHaveBeenCalledWith( 'wplocaldocker' );
			expect( mockDocker.getVolume ).toHaveBeenCalledWith( mockEnvUtils.cacheVolume );
			expect( mockCompose.upAll ).toHaveBeenCalled();
		} );

		it( 'is idempotent — second call is a no-op', async () => {
			const gateway = loadGateway();
			mockDocker._network.inspect.mockResolvedValue( {} );
			mockDocker._volume.inspect.mockResolvedValue( {} );

			const p1 = gateway.startGlobal( makeSpinner(), false );
			await jest.runAllTimersAsync();
			await p1;

			await gateway.startGlobal( makeSpinner(), false );

			expect( mockCompose.upAll ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'calls pullAll before upAll when pull=true', async () => {
			const gateway = loadGateway();
			mockDocker._network.inspect.mockResolvedValue( {} );
			mockDocker._volume.inspect.mockResolvedValue( {} );

			const callOrder = [];
			mockCompose.pullAll.mockImplementation( () => { callOrder.push( 'pullAll' ); return Promise.resolve(); } );
			mockCompose.upAll.mockImplementation( () => { callOrder.push( 'upAll' ); return Promise.resolve(); } );

			const p = gateway.startGlobal( makeSpinner(), true );
			await jest.runAllTimersAsync();
			await p;

			expect( callOrder ).toEqual( [ 'pullAll', 'upAll' ] );
		} );
	} );

	describe( 'stopGlobal', () => {
		it( 'calls compose.down and removes the network', async () => {
			const gateway = loadGateway();
			mockDocker._network.inspect.mockResolvedValue( {} );
			mockDocker._network.remove.mockResolvedValue();

			await gateway.stopGlobal( makeSpinner() );

			expect( mockCompose.down ).toHaveBeenCalled();
			expect( mockDocker._network.remove ).toHaveBeenCalled();
		} );

		it( 'swallows errors and resolves cleanly', async () => {
			const gateway = loadGateway();
			mockCompose.down.mockRejectedValue( new Error( 'compose error' ) );

			await expect( gateway.stopGlobal( makeSpinner() ) ).resolves.toBeUndefined();
		} );
	} );

	describe( 'restartGlobal', () => {
		it( 'calls ensureNetworkExists then compose.restartAll', async () => {
			const gateway = loadGateway();
			mockDocker._network.inspect.mockResolvedValue( {} );

			await gateway.restartGlobal( makeSpinner() );

			expect( mockDocker.getNetwork ).toHaveBeenCalledWith( 'wplocaldocker' );
			expect( mockCompose.restartAll ).toHaveBeenCalled();
		} );

		it( 'swallows errors and resolves cleanly', async () => {
			const gateway = loadGateway();
			mockDocker._network.inspect.mockResolvedValue( {} );
			mockCompose.restartAll.mockRejectedValue( new Error( 'restart error' ) );

			await expect( gateway.restartGlobal( makeSpinner() ) ).resolves.toBeUndefined();
		} );
	} );
} );
