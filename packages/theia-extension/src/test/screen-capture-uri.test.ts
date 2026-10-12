import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toScreenCaptureUri } from '../common/screen-capture-uri';

test('capture Windows absolute paths use the file provider with spaces and Unicode intact', () => {
  const uri = toScreenCaptureUri('C:\\Users\\Torkild\\Mine prosjekter\\øl.asm');
  assert.equal(uri.scheme, 'file');
  assert.equal(uri.path.toString(), '/c:/Users/Torkild/Mine prosjekter/øl.asm');
  const forward = toScreenCaptureUri('D:/projects/main.asm');
  assert.equal(forward.scheme, 'file');
  assert.equal(forward.path.toString(), '/d:/projects/main.asm');
});

test('capture UNC paths retain the server authority and share', () => {
  const uri = toScreenCaptureUri('\\\\server\\share\\main.asm');
  assert.equal(uri.scheme, 'file');
  assert.equal(uri.authority, 'server');
  assert.equal(uri.path.toString(), '/share/main.asm');
});

test('capture POSIX paths remain file resources', () => {
  const uri = toScreenCaptureUri('/workspace/main.asm');
  assert.equal(uri.scheme, 'file');
  assert.equal(uri.path.toString(), '/workspace/main.asm');
});

test('capture existing URI schemes remain intact', () => {
  const file = toScreenCaptureUri('file:///workspace/main.asm');
  assert.equal(file.scheme, 'file');
  assert.equal(file.path.toString(), '/workspace/main.asm');
  const remote = toScreenCaptureUri('vscode-remote://ssh-remote+host/workspace/main.asm');
  assert.equal(remote.scheme, 'vscode-remote');
  assert.equal(remote.authority, 'ssh-remote+host');
});
