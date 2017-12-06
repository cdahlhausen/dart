const fs = require('fs');
const path = require('path');
const AppSetting = require(path.resolve('electron/easy/app_setting'));
const BagItProfile = require(path.resolve('electron/easy/bagit_profile'));
const BagItProfileInfo = require(path.resolve('electron/easy/bagit_profile_info'));
const Choice = require(path.resolve('electron/easy/choice'));
const Const = require(path.resolve('electron/easy/constants'));
const Field = require(path.resolve('electron/easy/field'));
const Form = require(path.resolve('electron/easy/form'));
const StorageService = require(path.resolve('electron/easy/storage_service'));
const Util = require(path.resolve('electron/easy/util'));
const ValidationResult = require(path.resolve('electron/easy/validation_result'));

const macJunkFile = /._DS_Store$|.DS_Store$/i;
const dotFile = /\/\.[^\/]+$|\\\.[^\\]+$/;
const dotKeepFile = /\/\.keep$|\\\.keep$/i;

var kb = 1024;
var mb = 1024 * kb;
var gb = 1024 * mb;
var tb = 1024 * gb;

const Store = require('electron-store');
var db = new Store({name: 'jobs'});

module.exports = class Job {
    constructor() {
        this.id = Util.uuid4();
        this.files = [];
        this.bagItProfile = null;
        this.storageServices = [];
        this.options = new JobOptions();
        this._fullFileList = {};
    }
    clearFiles() {
        this.files = [];
        this._fullFileList = {};
    }
    getFiles() {
        return (Object.keys(this._fullFileList).sort());
    }
    hasFile(filepath) {
        return this._fullFileList[filePath] || false;
    }
    hasFiles() {
        return Object.keys(this._fullFileList).length > 0;
    }

    static filterFile(filepath, options) {
        // Return false if this file should be filtered out of the package.
        var isMacJunk = filepath.match(macJunkFile);
        if (options.skipDSStore && isMacJunk) {
            return false;
        }
        var isHidden = filepath.match(dotFile);
        var isDotKeep = filepath.match(dotKeepFile);
        if (options.skipHiddenFiles && isHidden && !isMacJunk && !isDotKeep) {
            return false;
        }
        if (options.skipDotKeep && !isMacJunk && (isHidden || isDotKeep)) {
            return false;
        }
        return true;
    }

    validate() {
        // TODO: write me!
        // Must include a file list, plus BagItProfile and/or StorageService.
        // If BagItProfile is valid, make sure it's valid.
        // If StorageService is present, make sure it's valid.
        // Make sure the working dir where we'll build the bag exists.
    }

    resetFileOptions() {
        this.options.skipDSStore = true;
        this.options.skipHiddenFiles = false;
        this.options.skipDotKeep = false;
    }

    toPackagingForm() {
        var availableProfiles = es.Util.sortByName(es.BagItProfile.getStore())
        var profileId = null;
        if (this.bagItProfile != null) {
            profileId = this.bagItProfile.id;
        }
        var form = new es.Form();
        form.fields['profile'] = new es.Field("profile", "profile", "Packaging", "");
        form.fields['profile'].help = "Select a packaging format, or None if you just want to send files to the storage area as-is.";
        var choices = es.Choice.makeList(availableProfiles, profileId, true);
        choices[0].value = "";
        choices[0].label = "None";
        form.fields['profile'].choices = choices;
        return form;
    }

    save() {
        return db.set(this.id, this);
    }

    static find(id) {
        var job = null;
        var obj = db.jobs.get(id);
        if (obj != null) {
            job = new Job();
            Object.assign(job, obj);
        }
        return job;
    }

    delete() {
        db.delete(this.id);
        return this;
    }

    getStore() {
        return db.store;
    }

    fileOptionsChanged() {
        this.options.skipDSStore = $('#filesSkipDSStore').prop('checked');
        this.options.skipHiddenFiles = $('#filesSkipHidden').prop('checked');
        this.options.skipDotKeep = $('#filesSkipDotKeep').prop('checked');
        $.each($("tr[data-object-type='File']"), function(index, row) {
            var filepath = $(row).data('filepath');
            deleteFile($(row).find('td').first());
            addFile(filepath);
        });
    }

    addFile(filepath) {
        $('#filesPanel').show()
        if (this._fullFileList[filepath] == true) {
            $('#fileWarning').html(filepath + ' has already been added')
            $('#fileWarningContainer').show(100);
            return
        }
        var stat = fs.statSync(filepath)
        var row = $(getTableRow(filepath, stat.isDirectory()))
        row.insertBefore('#fileTotals')
        var job = this;
        fs.stat(filepath, function(err, stats) {
            job.statPath(err, stats, filepath, row);
            job._fullFileList[filepath] = true;
        });
        $('#btnJobPackagingDiv').show();
    }

    deleteFile(cell) {
        var row = $(cell).parent('tr')
        var filepath = $(row).data('filepath')
        var dirCountCell = $(row).children('.dirCount').first()
        var fileCountCell = $(row).children('.fileCount').first()
        var sizeCell = $(row).children('.fileSize').first()
        var fileCount = parseInt(fileCountCell.data('total'), 10) || 0
        var size = parseInt(sizeCell.data('total'), 10) || 0
        var dirCount = parseInt(dirCountCell.data('total'), 10) || 0

        for (var file in this._fullFileList) {
            if (file.indexOf(filepath) == 0) {
                delete this._fullFileList[file];
            }
        }
        delete this._fullFileList[filepath];

        var totalDirCountCell = $('#totalDirCount')
        var prevTotalDirCount = parseInt(totalDirCountCell.data('total'), 10) || 0
        totalDirCountCell.data('total', (prevTotalDirCount - dirCount))
        totalDirCountCell.text(prevTotalDirCount - dirCount)

        var totalFileCountCell = $('#totalFileCount')
        var prevTotalFileCount = parseInt(totalFileCountCell.data('total'), 10) || 0
        totalFileCountCell.data('total', (prevTotalFileCount - fileCount))
        totalFileCountCell.text(prevTotalFileCount - fileCount)

        var totalSizeCell = $('#totalFileSize')
        var prevTotalSize = parseInt(totalSizeCell.data('total'), 10) || 0
        totalSizeCell.data('total', (prevTotalSize - size))
        totalSizeCell.text(formatFileSize(prevTotalSize - size))

        $(row).remove()

        if (!hasFiles()) {
            $('#btnJobPackagingDiv').hide();
        }
    }

    statPath(err, stats, filepath, row) {
        if (err != null) {
            console.log(err)
            return
        }
        if (Job.filterFile(filepath, this.options) == false) {
            return;
        }
        if (this._fullFileList[filepath] == true) {
            $('#fileWarning').html(filepath + ' has already been added')
            $('#fileWarningContainer').show(100);
            return
        }
        if (stats.isFile()) {
            updateFileStats(stats, row)
            this._fullFileList[filepath] = true
        } else if (stats.isDirectory()) {
            this.recurseIntoDir(filepath, row)
            this._fullFileList[filepath] = true;
        } else {
            console.log("Other -> " + filepath)
        }
    }

    recurseIntoDir(filepath, row) {
        updateStats(row, '.dirCount', 1)
        var job = this;
        fs.readdir(filepath, function(err, files) {
            if (err != null) {
                console.log(err)
                return
            }
            files.forEach(function (file) {
                var fullpath = path.join(filepath, file)
                fs.stat(fullpath, function(err, stats) {
                    job.statPath(err, stats, fullpath, row)
                });
            });
        });
    }

}

class JobOptions {
    constructor() {
        this.skipDSStore = true;
        this.skipHiddenFiles = false;
        this.skipDotKeep = false;
    }
}

function updateFileStats(stats, row) {
    updateStats(row, '.fileCount', 1)
    updateStats(row, '.fileSize', stats.size)
}

function updateStats(row, cssClass, amountToAdd) {
    var cell = $(row).find(cssClass).first()
    var prevValue = parseInt(cell.data('total'), 10) || 0
    var newValue = prevValue + amountToAdd
    cell.data('total', newValue)
    if (cssClass.indexOf('Count') > 0) {
        cell.text(newValue)
    } else {
        cell.text(formatFileSize(newValue))
    }

    var totalCell = getTotalCell(cssClass)
    prevValue = parseInt(totalCell.data('total'), 10) || 0
    newValue = prevValue + amountToAdd
    totalCell.data('total', newValue)
    if (cssClass.indexOf('Count') > 0) {
        totalCell.text(newValue)
    } else {
        totalCell.text(formatFileSize(newValue))
    }
}

function getTotalCell(cssClass) {
    switch(cssClass) {
    case '.dirCount':
        return $('#totalDirCount')
    case '.fileCount':
        return $('#totalFileCount')
    case '.fileSize':
        return $('#totalFileSize')
    }
    return null
}

function formatFileSize(size) {
    if (size > tb) {
        return (size / tb).toFixed(2) + " TB"
    }
    if (size > gb) {
        return (size / gb).toFixed(2) + " GB"
    }
    if (size > mb) {
        return (size / mb).toFixed(2) + " MB"
    }
    return (size / kb).toFixed(2) + " KB"
}

function getTableRow(filepath, isDir) {
    var icon = getIconForPath(filepath, isDir)
    return `<tr data-filepath="${filepath}" data-object-type="File">
        <td>${icon}</td>
        <td class="dirCount">0</td>
        <td class="fileCount">0</td>
        <td class="fileSize">0</td>
        <td class="deleteCell"><span class="glyphicon glyphicon-remove clickable-row" aria-hidden="true"></td>
        </tr>`
}

function getIconForPath(filepath, isDir) {
    if (isDir) {
        return getFolderIcon(filepath)
    }
    return getFileIcon(filepath)
}

function getFileIcon(filepath) {
    return '<span class="glyphicon glyphicon-file" aria-hidden="true" style="margin-right:10px"></span>' + filepath;
}

function getFolderIcon(filepath) {
    return '<span class="glyphicon glyphicon-folder-close" aria-hidden="true" style="margin-right:10px"></span>' + filepath;
}