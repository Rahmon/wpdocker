'use strict';

let mockQuery;
let mockDestroy;
let mockConnection;

jest.mock('mysql', () => ({
	createConnection: jest.fn(() => mockConnection),
}));

const mysql = require('mysql');
const { create, deleteDatabase, assignPrivs } = require('../../src/database');

beforeEach(() => {
	mockDestroy = jest.fn();
	mockQuery = jest.fn();
	mockConnection = { query: mockQuery, destroy: mockDestroy };
	mysql.createConnection.mockReturnValue(mockConnection);
});

describe('create', () => {
	it('issues CREATE DATABASE IF NOT EXISTS with correct dbname', async () => {
		mockQuery.mockImplementation((sql, cb) => cb(null));

		await create('mydb');

		expect(mockQuery).toHaveBeenCalledWith(
			'CREATE DATABASE IF NOT EXISTS `mydb`;',
			expect.any(Function),
		);
	});

	it('calls destroy on success', async () => {
		mockQuery.mockImplementation((sql, cb) => cb(null));

		await create('mydb');

		expect(mockDestroy).toHaveBeenCalledTimes(1);
	});

	it('calls destroy before rejecting on error', async () => {
		const calls = [];
		mockDestroy.mockImplementation(() => calls.push('destroy'));
		mockQuery.mockImplementation((sql, cb) => cb(new Error('query failed')));

		await expect(create('mydb')).rejects.toThrow();
		expect(calls).toContain('destroy');
	});

	it('rejects with an Error when query errors', async () => {
		mockQuery.mockImplementation((sql, cb) => cb(new Error('query failed')));

		await expect(create('mydb')).rejects.toBeInstanceOf(Error);
	});
});

describe('deleteDatabase', () => {
	it('issues DROP DATABASE IF EXISTS with correct dbname', async () => {
		mockQuery.mockImplementation((sql, cb) => cb(null));

		await deleteDatabase('mydb');

		expect(mockQuery).toHaveBeenCalledWith(
			'DROP DATABASE IF EXISTS `mydb`;',
			expect.any(Function),
		);
	});

	it('calls destroy on success', async () => {
		mockQuery.mockImplementation((sql, cb) => cb(null));

		await deleteDatabase('mydb');

		expect(mockDestroy).toHaveBeenCalledTimes(1);
	});

	it('calls destroy before rejecting on error', async () => {
		const calls = [];
		mockDestroy.mockImplementation(() => calls.push('destroy'));
		mockQuery.mockImplementation((sql, cb) => cb(new Error('drop failed')));

		await expect(deleteDatabase('mydb')).rejects.toThrow();
		expect(calls).toContain('destroy');
	});

	it('rejects with an Error when query errors', async () => {
		mockQuery.mockImplementation((sql, cb) => cb(new Error('drop failed')));

		await expect(deleteDatabase('mydb')).rejects.toBeInstanceOf(Error);
	});
});

describe('assignPrivs', () => {
	it('issues GRANT ALL PRIVILEGES with correct dbname', async () => {
		mockQuery.mockImplementation((sql, cb) => cb(null));

		await assignPrivs('mydb');

		expect(mockQuery).toHaveBeenCalledWith(
			"GRANT ALL PRIVILEGES ON `mydb`.* TO 'wordpress'@'%' IDENTIFIED BY 'password';",
			expect.any(Function),
		);
	});

	it('calls destroy on success', async () => {
		mockQuery.mockImplementation((sql, cb) => cb(null));

		await assignPrivs('mydb');

		expect(mockDestroy).toHaveBeenCalledTimes(1);
	});

	it('calls destroy before rejecting on error', async () => {
		const calls = [];
		mockDestroy.mockImplementation(() => calls.push('destroy'));
		mockQuery.mockImplementation((sql, cb) => cb(new Error('grant failed')));

		await expect(assignPrivs('mydb')).rejects.toThrow();
		expect(calls).toContain('destroy');
	});

	it('rejects with an Error when query errors', async () => {
		mockQuery.mockImplementation((sql, cb) => cb(new Error('grant failed')));

		await expect(assignPrivs('mydb')).rejects.toBeInstanceOf(Error);
	});
});
