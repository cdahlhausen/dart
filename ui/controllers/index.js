const { AboutController } = require('./about_controller');
const { AppSettingController } = require('./app_setting_controller');
const { BagItProfileController } = require('./bagit_profile_controller');
const { DashboardController } = require('./dashboard_controller');
const { HelpController } = require('./help_controller');
const { JobController } = require('./job_controller');
const { LogController } = require('./log_controller');
const { ManifestController } = require('./manifest_controller');
const { RemoteRepositoryController } = require('./remote_repository_controller');
const { SetupController } = require('./setup_controller');
const { UploadTargetController } = require('./upload_target_controller');

module.exports.AboutController = AboutController;
module.exports.AppSettingController = AppSettingController;
module.exports.BagItProfileController = BagItProfileController;
module.exports.DashboardController = DashboardController;
module.exports.HelpController = HelpController;
module.exports.JobController = JobController;
module.exports.LogController = LogController;
module.exports.ManifestController = ManifestController;
module.exports.RemoteRepositoryController = RemoteRepositoryController;
module.exports.SetupController = SetupController;
module.exports.UploadTargetController = UploadTargetController;
