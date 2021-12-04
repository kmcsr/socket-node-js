
'use strict';

const { PACKAGE_ID, NODE_STATUS } = require('./lib/constants');
const SocketNode = require('./lib/socket-node');
const SocketServerNode = require('./lib/socket-server-node');

SocketNode.PACKAGE_ID = PACKAGE_ID;
SocketNode.NODE_STATUS = NODE_STATUS;
SocketNode.Server = SocketNode.SocketServerNode = SocketServerNode;

module.exports = SocketNode;
