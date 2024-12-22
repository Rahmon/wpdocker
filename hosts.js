#!/usr/bin/env node

const yargs = require( 'yargs' );
const hostile = require( 'hostile' );

function options( yargs ) {
	yargs.positional( 'hosts', {
		describe: 'A host domain name.',
		type: 'string',
	} );
}

const IPs = [ '::1', '127.0.0.1' ];

function add( { hosts } ) {
	async function run() {
		try {
			for ( const ip of IPs ) {
				await new Promise(
					( resolve,reject ) => {
						hostile.set(
							ip,
							hosts.join( ' ' ),
							err => err ? reject( err ) : resolve()
						);
					}
				);
			}
			console.log( 'Added to hosts file successfully!' );
		} catch ( err ) {
			console.error( err.message );
			process.exit( err.errno );
		}
	}

	run();
}

function remove( { hosts } ) {
	async function run() {
		try {
			for ( const ip of IPs ) {
				await new Promise(
					( resolve,reject ) => {
						hostile.remove(
							ip,
							hosts.join( ' ' ),
							err => err ? reject( err ) : resolve()
						);
					}
				);
			}
			console.log( 'Added to hosts file successfully!' );
		} catch ( err ) {
			console.error( err.message );
			process.exit( err.errno );
		}
	}

	run();
}

// usage and help flag
yargs.scriptName( 'wpdocker-hosts' );
yargs.usage( 'Usage: wpdocker-hosts <command>' );
yargs.help( 'h' );
yargs.alias( 'h', 'help' );

// commands
yargs.command( 'add <hosts..>', 'Add new hosts to the hosts file.', options, add );
yargs.command( 'remove <hosts..>', 'Remove hosts from the hosts file.', options, remove );

// parse and process CLI args
yargs.demandCommand();
yargs.parse();
