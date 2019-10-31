'use strict';

var fs = require('fs');

/**
 * Generic data source.
 * Serves mainly as an interface definition.
 */
class DataSource {

    /**
     * Read the defined number of bytes as Buffer.
     */
    read(length) {
    }

    /**
     * Read hex string.
     */
    readHex(length) {
        return this.read(length).toString('hex').toUpperCase();
    }

    /**
     * Read UInt64LE as Number or BigInt if needed.
     */
    readUInt64LE() {
        let value = this.read(8).readBigUInt64LE();
        return value < Number.MAX_SAFE_INTEGER ? Number(value) : value;
    }

    /**
     * Read UInt32LE as Number.
     */
    readUInt32LE() {
        return this.read(4).readUInt32LE();
    }

    /**
     * Read Int32LE as Number.
     */
    readInt32LE() {
        return this.read(4).readInt32LE();
    }

    /**
     * Read UInt16LE as Number.
     */
    readUInt16LE() {
        return this.read(2).readUInt16LE();
    }

    /**
     * Read UInt8 as Number.
     */
    readUInt8() {
        return this.read(1)[0];
    }

    /**
     * Skip the defined number of bytes.
     */
    skip(length) {
    }

    /**
     * Close the underlying data source.
     */
    close() {
    }

    /**
     * Get reader's cursor position.
     */
    cursor() {
    }

}
module.exports.DataSource = DataSource;

/**
 * File based data source.
 */
class FileSource extends DataSource {

    constructor(path, bufferSize) {
        super();
        this.fileDesc = fs.openSync(path, 'r');
        this.filePosition = 0;
        this.sourceBuffer = Buffer.alloc(bufferSize || 0x3fff);
        this.bufferLength = 0;
        this.bufferOffset = 0;
    }

    close() {
        fs.closeSync(this.fileDesc);
    }

    /**
     * Read another portion of the file into the target buffer.
     */
    readFile(buffer) {
        var reminderLength = this.bufferLength - this.bufferOffset;
        // Copy buffer reminder to the beginning of the target buffer
        this.sourceBuffer.copy(buffer, 0, this.bufferOffset, this.bufferLength);
        // Reset read length and position
        this.bufferLength = 0;
        this.bufferOffset = 0;
        // Try to read the rest of the buffer
        var bytesRead = fs.readSync(this.fileDesc, buffer, reminderLength, buffer.length - reminderLength, this.filePosition);
        this.filePosition += bytesRead;
        return buffer.slice(0, reminderLength + bytesRead);
    }

    /**
     * Read data using the internal buffer.
     */
    readBuffer(length) {
        if (this.bufferOffset + length > this.bufferLength) {
            this.bufferLength = this.readFile(this.sourceBuffer).length;
        }
        if (this.bufferOffset + length > this.bufferLength) {
            length = this.bufferLength;
        }
        this.bufferOffset += length;
        return this.sourceBuffer.slice(this.bufferOffset - length, this.bufferOffset);
    }

    read(length) {
        if (length > this.sourceBuffer.length) {
            return this.readFile(Buffer.alloc(length));
        } else {
            return this.readBuffer(length);
        }
    }

    skip(length) {
        this.bufferOffset += length;
        if (this.bufferOffset > this.bufferLength) {
            this.filePosition += this.bufferOffset - this.bufferLength;
            this.bufferOffset = 0;
            this.bufferLength = 0;
        }
    }

    cursor() {
        return this.filePosition - this.bufferLength + this.bufferOffset;
    }

}
module.exports.FileSource = FileSource;
