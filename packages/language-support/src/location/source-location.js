"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPosition = createPosition;
exports.createRange = createRange;
exports.createLocation = createLocation;
exports.comparePositions = comparePositions;
exports.containsPosition = containsPosition;
exports.isZeroLengthRange = isZeroLengthRange;
function createPosition(line, character) {
    return { line, character };
}
function createRange(startLine, startCharacter, endLine, endCharacter) {
    return {
        start: createPosition(startLine, startCharacter),
        end: createPosition(endLine, endCharacter)
    };
}
function createLocation(uri, startLine, startCharacter, endLine, endCharacter) {
    return {
        uri,
        range: createRange(startLine, startCharacter, endLine, endCharacter)
    };
}
function comparePositions(left, right) {
    if (left.line !== right.line) {
        return left.line - right.line;
    }
    return left.character - right.character;
}
function containsPosition(range, position) {
    return (comparePositions(range.start, position) <= 0 &&
        comparePositions(position, range.end) <= 0);
}
function isZeroLengthRange(range) {
    return comparePositions(range.start, range.end) === 0;
}
//# sourceMappingURL=source-location.js.map