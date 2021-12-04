
'use strict';

const NUMBER_RE = /^(?:[1-9][0-9]*)/;

const PACKAGE_ID = {
	MESSAGE: 1,
	REPLY: 2,
	PING: 3,
	PONG: 4,
	CLOSE: 5,
	INIT: 7,
	1: 'MESSAGE',
	2: 'REPLY',
	3: 'PING',
	4: 'PONG',
	5: 'CLOSE',
	7: 'INIT'
};

const NODE_STATUS = {
	INIT: 1,
	READY: 2,
	CLOSE: 3
}

module.exports = {
	NUMBER_RE,
	PACKAGE_ID,
	NODE_STATUS
}
