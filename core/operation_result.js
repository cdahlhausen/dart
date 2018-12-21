const dateFormat = require('dateformat');
const { Util } = require('./util');

/**
 * OperationResult contains information about the result of a job operation.
 * Operations may include bagging, validation, uploading, etc.
 */

class OperationResult {
    /**
     * Creates a new OperationResult.
     *
     * @param {string} operation - The name of the operation that was attempted.
     *
     * @param {string} provider - The name of the plugin that attempted to
     * perform the operation.
     */
    constructor(operation, provider) {
        /**
        * The name of the operation that was attempted. For example,
        * 'bagging', 'validation', 'upload', etc. Full list is yet
        * to be determined.
        *
        * @type {string}
        */
        this.operation = operation;
        /**
        * The name of the plugin that attempted to perform the operation.
        *
        * @type {string}
        */
        this.provider = provider;
        /**
        * The path to the file that packaged, stored, validated or otherwise
        * operated on.
        *
        * @type {string}
        */
        this.filepath = null;
        /**
        * The size of the file that packaged, stored, validated or otherwise
        * operated on.
        *
        * @type {string}
        */
        this.filesize = 0;
        /**
        * The modification timestamp of the file that packaged, stored, validated
        * or otherwise operated on.
        *
        * @type {Date}
        */
        this.fileMtime = null;
        /**
         * remoteChecksum is the checksum returned by the remote
         * storage service after upload, if applicable. For S3 storage,
         * this will be the e-tag. For FTP transfers and bagging
         * operations, this will remain null.
         *
         * @type {string}
         */
        this.remoteChecksum = null;
        /**
        * The number of times DART attempted this operation.
        *
        * @type {string}
        */
        this.attempt = 0;
        /**
        * Time at which DART last attempted this operation.
        *
        * @type {Date}
        */
        this.started = null;
        /**
        * Time at which DART completed this operation.
        *
        * @type {Date}
        */
        this.completed = null;
        /**
        * Indicates whether or not the operation succeeded.
        *
        * @type {boolean}
        */
        this.succeeded = false;
        /**
        * The URL of the object or file in the remote storage service.
        * This will be set only on upload operations. It describes
        * where the file was uploaded.
        *
        * @type {string}
        */
        this.remoteURL = null;
        /**
        * Informational message about the operation. This can be
        * used for logging, debugging, or display.
        *
        * @type {string}
        */
        this.info = null;
        /**
        * Warning message about the operation.
        *
        * @type {string}
        */
        this.warning = null
        /**
        * Error messages describing what went wrong during the operation.
        *
        * @type {Array<string>}
        */
        this.errors = [];
    }
    /**
     * This resets all of the properties of the OperationResult,
     * except operation, provider, and attempt. DART calls
     * this before it retries a failed operation.
     *
     */
    reset() {
        this.started = null;
        this.completed = null;
        this.succeeded = false;
        this.filepath = null;
        this.filesize = 0;
        this.fileMtime = null;
        this.remoteURL = null;
        this.remoteChecksum = null;
        this.info = null;
        this.warning = null;
        this.errors = [];
    }

    /**
     * This resets all of the properties of the OperationResult,
     * except operation, provider, and attempt, and sets the
     * started attribute to the current datetime, in ISO format.
     * It also increments the attempt attribute.
     *
     */
    start() {
        this.reset();
        this.started = dateFormat(Date.now(), 'isoUtcDateTime');
        this.attempt += 1;
    }

    /**
     * Sets the completed attribute to the current datetime, in ISO format,
     * and sets the succeeded and errors attributes.
     *
     * @param {boolean} succeeded - Indicates whether or not the operation
     * succeeded.
     *
     * @param {string} errorMessage - An optional error message. If this is
     * passed in, it will be appended the errors array.
     */
    finish(succeeded, errorMessage) {
        this.completed = dateFormat(Date.now(), 'isoUtcDateTime');
        this.succeeded = succeeded;
        if (errorMessage) {
            this.errors.push(errorMessage);
        }
    }

    /**
     * Returns the first error message in the result's errors array, or
     * undefined if there are no errors. This is useful for handling
     * error events emitted by plugins.
     *
     * @returns {string}
     */
    firstError() {
        if (this.errors.length > 0) {
            return this.errors[0];
        }
    }

    /**
     * Returns the last error message in the result's errors array, or
     * undefined if there are no errors. This is useful for handling
     * error events emitted by plugins.
     *
     * @returns {string}
     */
    lastError() {
        if (this.errors.length > 0) {
            return this.errors[this.errors.length-1];
        }
    }

}

module.exports.OperationResult = OperationResult;
