#!/usr/bin/env node
import { DapConnection } from './dap-connection';
import { ViceDebugSession } from './vice-debug-session';

const connection = new DapConnection(process.stdin, process.stdout);
const session = new ViceDebugSession(connection);

connection.onRequest((request) => {
  void session.handleRequest(request);
});
connection.start();
