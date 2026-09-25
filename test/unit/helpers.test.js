'use strict';

const { unleadingslashit, untrailingslashit, removeEndSlashes } = require('../../src/helpers');

describe('unleadingslashit', () => {
	it('removes a leading slash', () => {
		expect(unleadingslashit('/foo')).toBe('foo');
	});

	it('removes multiple leading slashes', () => {
		expect(unleadingslashit('///foo')).toBe('foo');
	});

	it('leaves a string with no leading slash unchanged', () => {
		expect(unleadingslashit('foo')).toBe('foo');
	});

	it('leaves an empty string unchanged', () => {
		expect(unleadingslashit('')).toBe('');
	});

	it('does not remove a trailing slash', () => {
		expect(unleadingslashit('foo/')).toBe('foo/');
	});
});

describe('untrailingslashit', () => {
	it('removes a trailing slash', () => {
		expect(untrailingslashit('foo/')).toBe('foo');
	});

	it('removes only one trailing slash', () => {
		expect(untrailingslashit('foo//')).toBe('foo/');
	});

	it('leaves a string with no trailing slash unchanged', () => {
		expect(untrailingslashit('foo')).toBe('foo');
	});

	it('leaves an empty string unchanged', () => {
		expect(untrailingslashit('')).toBe('');
	});

	it('does not remove a leading slash', () => {
		expect(untrailingslashit('/foo')).toBe('/foo');
	});
});

describe('removeEndSlashes', () => {
	it('removes both leading and trailing slashes', () => {
		expect(removeEndSlashes('/foo/')).toBe('foo');
	});

	it('removes multiple leading slashes', () => {
		expect(removeEndSlashes('///foo')).toBe('foo');
	});

	it('removes a trailing slash but only one', () => {
		expect(removeEndSlashes('foo//')).toBe('foo/');
	});

	it('leaves a string with no slashes unchanged', () => {
		expect(removeEndSlashes('foo')).toBe('foo');
	});

	it('leaves an empty string unchanged', () => {
		expect(removeEndSlashes('')).toBe('');
	});

	it('handles slashes on both ends with multiple leading slashes', () => {
		expect(removeEndSlashes('///foo/')).toBe('foo');
	});
});
