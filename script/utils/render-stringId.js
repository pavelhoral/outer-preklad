/**
 * Render string ID as hex string.
 */
module.exports = function renderStringId(stringId) {
    var hexId = (stringId | 0).toString(16).toUpperCase();
    return '[' + '00000000'.substring(0, 8 - hexId.length) + hexId + ']';
};
