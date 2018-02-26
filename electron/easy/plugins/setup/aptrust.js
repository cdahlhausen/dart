// Field is a form field.
const os = require('os');
const path = require('path');
const process = require('process');
const AppSetting = require('../../core/app_setting');
const BagItProfile = require('../../core/bagit_profile');
const builtinProfiles = require('../../core/builtin_profiles');
const builtinServices = require('../../core/builtin_services');
const Field = require('../../core/field');
const StorageService = require('../../core/storage_service');

const name = "APTrust";
const description = "Provides setup questions for APTrust";
const version = "0.1";

class APTrust {

    // Constructor is required for this type of plugin.
    constructor() {
        this.fields = [];
        this._initFields();
    }

    // describe returns descriptive info about the plugin, so it
    // can be discovered by the app.
    describe() {
        return { name: name,
                 description: description,
                 version: version,
               };
    }

    // Plugin manager will call this...
    installRequiredSettings() {
        this._installAppSettings();
        this._installBagItProfiles();
        this._installStorageServices();
    }

    // Add app settings required by APTrust.
    _installAppSettings() {
        // Ensure that required, built-in AppSettings are present
        if (es.AppSetting.findByName("Institution Domain") == null) {
            console.log("Adding APTrust setting 'Institution Domain'");
            var setting = new es.AppSetting("Institution Domain", "example.org");
            setting.userCanDelete = false;
            setting.help = "Set this to the value of your organization's internet domain. This is a required setting. You cannot delete it. You can only change its value."
            setting.save();
        }
        if (es.AppSetting.findByName("Bagging Directory") == null) {
            console.log("Adding APTrust setting 'Bagging Directory'");
            var dir = path.join(os.homedir(), "tmp", "easy-store");
            var setting = new es.AppSetting("Bagging Directory", dir);
            setting.userCanDelete = false;
            setting.help = "Where should Easy Store create bags?";
            setting.save();
        }
        if (es.AppSetting.findByName("Path to Bagger") == null) {
            console.log("Adding APTrust setting 'Path to Bagger'");
            var appName = os.platform == 'win32' ? "apt_create_bag.exe" : "apt_create_bag";
            var appPath = path.join(os.homedir(), appName);
            var setting = new es.AppSetting("Path to Bagger", appPath);
            setting.userCanDelete = false;
            setting.help = "What is the full path to the apt_create_bag executable?";
            setting.save();
        }

    }

    // Add required BagIt profiles
    _installBagItProfiles() {
        if (!BagItProfile.find(builtinProfiles.APTrustProfileId)) {
            console.log("Creating APTrust bagit profile");
            BagItProfile.createProfileFromBuiltIn(builtinProfiles.APTrustProfileId);
        }
        if (!BagItProfile.find(builtinProfiles.DPNProfileId)) {
            console.log("Creating DPN bagit profile");
            BagItProfile.createProfileFromBuiltIn(builtinProfiles.DPNProfileId);
        }
    }

    // Install storage services required by APTrust
    _installStorageServices() {

    }

    _initFields() {
        var domainNamePattern = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/;
        var macLinuxFilePattern = /(\/\w+)+/;  // This is a little simplistic. Looking for an absolute path.
        var windowsFilePattern = /^(?:[a-z]:|\\\\[a-z0-9_.$-]+\\[a-z0-9_.$-]+)\\(?:[^\\\/:*?"<>|\r\n]+\\)*[^\\\/:*?"<>|\r\n]*$/;

        var orgName = this._getSetupField('orgName', 'Organization Name');
        orgName.help = "Enter the name of your organization. This name will be written into the Source-Organization field of the bag-info.txt file of each APTrust bag you create. Examples: 'University of Virginia', 'University of Virginia School of Law'.";
        this.fields.push(orgName);

        var domain = this._getSetupField('domain', 'Domain Name');
        domain.help = "Enter your institution's domain name. For example, 'unc.edu', 'virginia.edu'. If you are making deposits for only one part of a larger organization, enter your group's sub-domain. For example, 'med.virginia.edu', 'law.virginia.edu', etc.";
        domain.validator = function(value) {
            if(value && value.match(domainNamePattern)) {
                domain.error = "";
                return true
            }
            domain.error = "Please enter a valid domain name.";
        }
        this.fields.push(domain);

        var pathToBagger = this._getSetupField('pathToBagger', 'Path to Bagger');
        pathToBagger.help = "The EasyStore installation package includes a program called apt_create_bag, which packages your files into BagIt bags. Save that program to a safe place on your computer and enter the location here. For Windows users, the path should end with '.exe'; for Mac and Linux users, it should not. For example: 'c:\Users\josie\Documents\apt_create_bag.exe', '/User/josie/bin/apt_create_bag'."
        pathToBagger.validator = function(value) {
            var pattern = macLinuxFilePattern;
            var suffix = "apt_create_bag";
            var errMsg = "Enter an absolute path that begins with a forward slash and ends with /apt_create_bag";
            if (process.platform == 'windows') {
                pattern = windowsFilePattern;
                suffix = "apt_create_bag.exe"
                errMsg = "Enter an absolute path that ends with \apt_create_bag.exe";
            }
            if (value && value.match(pattern) && value.endsWith(suffix)) {
                pathToBagger.error = "";
                return true;
            }
            pathToBagger.error = errMsg;
            return false;
        }
        this.fields.push(pathToBagger);

        var baggingDir = this._getSetupField('baggingDir', 'Bagging Directory');
        baggingDir.help = "Where should the bagger assemble bags? This should be a directory name. Examples: 'c:\Users\josie\Documents\APTrustBags', '/User/josie/temp'.";
        baggingDir.validator = function(value) {
            var pattern = macLinuxFilePattern;
            var errMsg = "Enter an absolute path that begins with a forward slash.";
            if (process.platform == 'windows') {
                pattern = windowsFilePattern;
                errMsg = "Enter an absolute path, like C:\Users\josie or \\server\share\folder";
            }
            if (value && value.match(pattern)) {
                baggingDir.error = "";
                return true;
            }
            baggingDir.error = errMsg;
            return false;
        }
        this.fields.push(baggingDir);

        var awsAccessKeyId = this._getSetupField('awsAccessKeyId', 'AWS Access Key ID');
        awsAccessKeyId.help = "Enter your AWS Access Key ID here, if you received one. This is the shorter of the two keys. If you did not receive an AWS access key, contact help@aptrust.org to get one."
        awsAccessKeyId.attrs['required'] = false;
        awsAccessKeyId.validator = function(value) {
            if (value && (value.length < 16 || value.length > 128)) {
                awsAccessKeyId.error = "Value should be between 16 and 128 characters long.";
                return false;
            }
            awsAccessKeyId.error = "";
            return true;
        }
        this.fields.push(awsAccessKeyId);

        var awsSecretAccessKey = this._getSetupField('awsSecretAccessKey', 'AWS Secret Access Key');
        awsSecretAccessKey.help = "Enter your AWS Secret Access Key here, if you received one. This is the longer of the two keys. If you did not receive an AWS access key, contact help@aptrust.org to get one."
        awsSecretAccessKey.attrs['required'] = false;
        awsSecretAccessKey.validator = function(value) {
            if (value && (value.length < 16 || value.length > 128)) {
                awsSecretAccessKey.error = "Value should be between 16 and 128 characters long.";
                return false;
            }
            awsSecretAccessKey.error = "";
            return true;
        }
        this.fields.push(awsSecretAccessKey);

    }

    // _getSetupField is a utility function that returns a Field object for a
    // question on your setup form.
    _getSetupField(name, label) {
        var field = new Field(name, name, label, '');
        field.attrs['required'] = true;
        return field;
    }

}

module.exports.Setup = APTrust;
module.exports.name = name;
module.exports.description = description;
module.exports.version = version;
