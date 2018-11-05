const { BagItFile } = require('./bagit_file');
const { Constants } = require('../core/constants');
const { Context } = require('../core/context');
const crypto = require('crypto');
const EventEmitter = require('events');
const { FileSystemReader } = require('../packaging/file_system_reader');
const fs = require('fs');
const { ManifestParser } = require('./manifest_parser');
const os = require('os');
const path = require('path');
const stream = require('stream');
const { TagFileParser } = require('./tag_file_parser');
const { TarReader } = require('../packaging/tar_reader');
const { TaskDescription } = require('./task_description');
const { Util } = require('../core/util');

/**
 * Validator validates BagIt packages (tarred or in directory format)
 * according to a BagIt profile.
 *
 * See the validate() method for a list of events.
 *
 */
class Validator extends EventEmitter {

    /**
     * Constructs a new BagIt validator.
     *
     * @param {string} pathToBag is the absolute path the the bag,
     * whether it's a directory or a tar file.
     *
     * @param {BagItProfile} profile is the BagItProfile that describes
     * what consititutes a valid bag.
     *
     */
    constructor(pathToBag, profile) {
        super();
        /**
         * pathToBag is the path to the directory or tar file that
         * contains the bag you want to validate.
         *
         * @type {string}
         */
        this.pathToBag = pathToBag;
        /**
         * profile is the BagItProfile against which we will validate
         * the bag.
         *
         * @type {BagItProfile}
         */
        this.profile = profile;
        /**
         * bagName is the calculated name of the bag, which will be either
         * the name of the directory that contains the bag files, or the name
         * of the tar file, minus the .tar extension. You can override this
         * by setting it explicitly.
         *
         * @type {BagItProfile}
         */
        this.bagName = path.basename(pathToBag, '.tar');
        /**
         * files is a hash of BagItFiles, where the file's path
         * within the bag (relPath) is the key, and the BagItFile
         * object is the value. The hash makes it easy to get files
         * by relative path within the archive (e.g. data/photos/img.jpg).
         *
         * @type {object.<string, BagItFile>}
        */
        this.files = {};
        /**
         * topLevelDirs is a list of strings representing the relative
         * paths of all of the directories found at the top level of the
         * bag. The "data" directory should always be in this list, if a
         * bag is valid. The validator tracks these because some BagItProfiles
         * allow top-level directories other than "data" and some do not.
         *
         * @type {Array<string>}
         */
        this.topLevelDirs = [];
        /**
         * topLevelFiles is a list of strings representing the relative
         * paths of all of the files found at the top level of the
         * bag. The "bagit.txt" and "bag-info.txt" files along with at least
         * one paylowd manifest should always be in this list if a bag is valid.
         * The validator tracks these because  some BagItProfiles allow additional
         * top-level files (other than required tag files and manifests) and some
         * do not.
         *
         * @type {Array<string>}
         */
        this.topLevelFiles = [];
        /**
         * reader will be an object capable of reading the either the tarred
         * bag (a {@link TarIterator}) or an untarred bag
         * {@link FileSystemIterator}. Classes for reading various formats
         * must implement the same read() interface and emit the same events
         * as either {@link TarIterator} or {@link FileSystemIterator}, both
         * of which are in the packaging directory of the DART project.
         *
         * @type {object}
         */
        this.reader = null;
        /**
         * errors is a list of error messages describing problems encountered
         * while trying to validate the bag or specific violations of the
         * BagItProfile that render this bag invalid.
         *
         * @type {Array<string>}
         */
        this.errors = [];

        // -----------------------------------------------------------------
        // TODO: Attach log listeners for this object's events,
        // so debug logger can print info about what's happening.
        // -----------------------------------------------------------------
    }

    /**
     * readingFromTar returns true if the bag being validated is in tar format.
     *
     * @returns {boolean}
     */
    readingFromTar() {
        return this.pathToBag.endsWith('.tar');
    }

    /**
     * Returns an array of BagItFile objects that represent payload files.
     *
     * @returns {Array<BagItFile>}
     */
    payloadFiles() {
        return Object.entries(this.files).filter(f => f[1].isPayloadFile());
    }

    /**
     * Returns an array of BagItFile objects that represent payload manifests.
     *
     * @returns {Array<BagItFile>}
     */
    payloadManifests() {
        return Object.entries(this.files).filter(f => f[1].isPayloadManifest());
    }

    /**
     * Returns an array of BagItFile objects that represent tag files.
     *
     * @returns {Array<BagItFile>}
     */
    tagFiles() {
        return Object.entries(this.files).filter(f => f[1].isTagFile());
    }

    /**
     * Returns an array of BagItFile objects that represent tag manifests.
     *
     * @returns {Array<BagItFile>}
     */
    tagManifests() {
        return Object.entries(this.files).filter(f => f[1].isTagManifest());
    }

    /**
     * validate runs all validation operations on the bag specified in the
     * validator's pathToBag property. This includes:
     *
     * * making sure the untarred bag name matches the tarred bag name
     * * validation checksums for all payload files, and for tag files that have checksums
     * * ensuring there are no extra or missing payload files
     * * ensuring that required tag files and manifests are present and valid
     * * ensuring that required tags are present and, where applicable, have legal values
     *
     * This method emits events "start", "task", "end", and "error".
     */
    validate() {
        this.emit('validateStart', `Validating ${this.pathToBag}`);
        if (this.readingFromTar()) {
            this.reader = new TarReader(this.pathToBag);
        } else {
            this.reader = new FileSystemReader(this.pathToBag);
        }
        // Attach listeners to our reader.
        var validator = this;
        this.reader.on('entry', function (entry) { validator._readEntry(entry) });
        this.reader.on('error', function(err) { validator.emit('error', err) });

        // Once reading is done, validate all the info we've gathered.
        this.reader.on('finish', function() {
            // Is this really what we want to emit here?
            validator.emit('task', new TaskDescription(validator.pathToBag, 'read'))
            validator._validateFormatAndContents();
        });

        // Read the contents of the bag.
        this.reader.read();
    }

    _validateFormatAndContents() {
        this._validateTopLevelDirs();
        this._validateTopLevelFiles();
        this._validateRequiredManifests();
        this._validateRequiredTagManifests();
        this._validateManifests(); // payload and tag
        this._validateNoExtraneousPayloadFiles();
        this._validateTags();
        this.emit('end')
    }

    /**
     * _readEntry reads a single entry from a TarReader or FileSystemReader.
     * An entry represents one file within the bag (any type of file: payload,
     * manifest, tag manifest, or tag file). This method add's the file's metadata
     * to the Validator.files hash, computes the file's checksums, and parses the
     * file's contents if necessary.
     *
     * @param {object} entry - An entry returned by a TarReader or FileSystemReader.
     *
     */
    _readEntry(entry) {
        if (entry.fileStat.isFile()) {
            var bagItFile = this._addBagItFile(entry);
            this._readFile(bagItFile, entry.stream);
        } else {
            // Skip directories, symlinks, etc.
            entry.stream.pipe(new stream.PassThrough());
            Context.logger.info(`Validator: ${entry.relPath} as is not a regular file`);
        }
    }

    /**
     * _addBagItFile adds a BagItFile to the Validator.files hash, based on
     * the entry it receives from the reader. At this point, the newly created
     * BagItFile will have its path and stats info, but no parsed data or
     * checksums.
     *
     * @param {object} entry - An entry returned by a TarReader or FileSystemReader.
     *
     * @param {string} entry.relPath - The relative path of the file inside the bag.
     *
     * @param {FileStat|fs.Stat} entry.fileStat - An object containing stats info
     * about the file.
     *
     * @returns {BagItFile} The BagItFile created from the entry object.
     *
     */
    _addBagItFile(entry) {
        this.emit('task', new TaskDescription(entry.relPath, 'add'));
        var relPath = this._cleanEntryRelPath(entry.relPath);
        var absPath = '';
        if (!this.readingFromTar()) {
            absPath = path.join(this.pathToBag, relPath);
        }
        var bagItFile = new BagItFile(absPath, relPath, entry.fileStat);
        this.files[entry.relPath] = bagItFile;
        var fileType = BagItFile.getFileType(relPath);
        Context.logger.info(`Validator added ${entry.relPath} as ${fileType}`);
        return bagItFile;
    }

    /**
     * _cleanEntryRelPath removes trailing slashes from relPath. When the
     * validator is reading from a tar file, this also removes the leading
     * bag name from the path. Since tarred bags must untar to a directory
     * whose name matches the bag, relative paths within tar files will
     * always be prefixed with the bag name. To get a true relative path,
     * we have to change "bagname/data/file.txt" to "data/file.txt".
     *
     * @param {string} relPath - The relative path, as we got it from the
     * TarReader or FileSystemReader.
     *
     * @returns {string} A clean version of the relative path.
     *
     */
    _cleanEntryRelPath(relPath) {
        var cleanPath = relPath;
        if (this.readingFromTar()) {
            var tarFileName = path.basename(this.pathToBag, '.tar');
            var re = new RegExp("^" + tarFileName + "/");
            cleanPath = relPath.replace(re, '');
        }
        return cleanPath.replace(/\/$/, '');
    }

    /**
     * _readFile pushes the file's bits through whatever checksum algorithms
     * the {@link BagItProfile} says we're supposed to validate. It also parses
     * the contents of the file, if it happens to be a manifest, tag manifest,
     * or text-based tag file.
     *
     * Note that the read() method of TarReader and FileSystemReader will not
     * advance until we've read the entire stream (or until it closes or errors out).
     *
     * @param {BagItFile} bagItFile - A file inside the directory or tarball.
     *
     * @param {ReadStream} stream - A stream from which we can read the file's
     * contents.
     */
    _readFile(bagItFile, stream) {
        this.emit('task', new TaskDescription(bagItFile.relDestPath, 'checksum'));

        // Get pipes for all of the hash digests we'll need to calculate.
        // We need to calculate checksums on everything in the bag.
        var pipes = this._getCryptoHashes(bagItFile)

        // For manifests, tag manifests, and tag files, we need to parse
        // file contents as well.
        if (bagItFile.isPayloadManifest() || bagItFile.isTagManifest()) {
            var manifestParser = new ManifestParser(bagItFile);
            pipes.push(manifestParser.stream);
        } else if (bagItFile.isTagFile() && bagItFile.relDestPath.endsWith(".txt")) {
            var tagFileParser = new TagFileParser(bagItFile);
            pipes.push(tagFileParser.stream);
        }

        // Now we can do a single read of the file, piping it through
        // streams for checksum calculations and parsing. This is much
        // more efficient than doing a seperate read for each, especially
        // in bags that use multiple digest algorithms.
        for (var p of pipes) {
            stream.pipe(p);
        }

        Context.logger.info(`Validator is running checksums for ${bagItFile.relDestPath}`);
    }

    /**
     * _getCryptoHashes returns a list of prepared cryptographic hashes that
     * are ready to have bits streamed through them. Each hash includes a
     * pre-wired 'finish' event that assigns the computed checksum to the
     * BagItFile's checksums hash. For example, a sha256 hash, once the bits
     * have been pushed through it, will set the following in it's finish event:
     *
     * @example
     * bagItFile.checksums['sha256'] = "[computed hex value]";
     *
     * @param {BagItFile} bagItFile - A file inside the directory or tarball.
     * This is the file whose checksums will be computed.
     *
     * @returns {Array<crypto.Hash>}
     *
     */
    _getCryptoHashes(bagItFile) {
        var hashes = [];
        for (var algorithm of this.profile.manifestsRequired) {
            var hash = crypto.createHash(algorithm);
            hash.setEncoding('hex');
            hash.on('finish', function() {
                hash.end();
                bagItFile.checksums[algorithm] = hash.read();
            });
            hashes.push(hash);
        }
        return hashes;
    }


    _validateTopLevelDirs() {
        Context.logger.info(`Validator: Validating top-level directories in ${this.pathToBag}`);
        var exceptions = ['data']; // data dir is always required
        for (var f of this.profile.tagFileNames()) {
            var requiredTagDir = f.split('/', 1);
            exceptions.push(requiredTagDir);
        }
        if (!this.profile.allowMiscTopLevelDirectories) {
            for (var dir of this.topLevelDirs) {
                if (!Util.listContains(exceptions, dir)) {
                    this.errors.push(`Profile prohibits top-level directory ${dir}`);
                }
            }
        }
    }

    _validateTopLevelFiles() {
        Context.logger.info(`Validator: Validating top-level files in ${this.pathToBag}`);
        if (!this.profile.allowMiscTopLevelFiles) {
            var exceptions = this.profile.tagFileNames();
            for (var alg of this.profile.manifestsRequired) {
                exceptions.push(`manifest-${alg}.txt`);
            }
            for (var alg of this.profile.tagManifestsRequired) {
                exceptions.push(`tagmanifest-${alg}.txt`);
            }
            for (var name of this.topLevelFiles) {
                if (name == 'fetch.txt') {
                    // This one has its own rule
                    if (!this.profile.allowFetchTxt) {
                        this.errors.push(`Bag contains fetch.txt file, which profile prohibits.`);
                    }
                    continue;
                }
                if (!Util.listContains(exceptions, name)) {
                    this.errors.push(`Profile prohibits top-level file ${name}`);
                }
            }
        }
    }

    _validateRequiredManifests() {

    }

    _validateRequiredTagManifests() {

    }

    // payload and tag
    _validateManifests() {

    }

    _validateNoExtraneousPayloadFiles() {

    }

    _validateTags() {

    }

}

module.exports.Validator = Validator;
