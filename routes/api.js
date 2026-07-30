const express = require('express');
const router = express.Router();
const multer = require('multer');

router.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const DashboardApiController = require('../controllers/Api/DashboardApiController');
const FileManagerController = require('../controllers/FileManagerController');
const SslController = require('../controllers/SslController');
const DatabaseController = require('../controllers/DatabaseController');
const authApi = require('../middleware/authApi');

router.get('/dashboard/stats', authApi, DashboardApiController.stats);

router.get('/file-manager/list', authApi, FileManagerController.list);
router.get('/file-manager/read', authApi, FileManagerController.readFile);
router.post('/file-manager/write', authApi, FileManagerController.writeFile);
router.post('/file-manager/mkdir', authApi, FileManagerController.createDir);
router.post('/file-manager/create-file', authApi, FileManagerController.createFile);
router.post('/file-manager/rename', authApi, FileManagerController.rename);
router.post('/file-manager/delete', authApi, FileManagerController.delete);
router.get('/file-manager/info', authApi, FileManagerController.getInfo);
router.post('/file-manager/upload', authApi, upload.single('file'), FileManagerController.upload);
router.post('/file-manager/extract', authApi, FileManagerController.extract);

router.get('/ssl/certs', authApi, SslController.listCerts);
router.post('/ssl/request', authApi, SslController.request);
router.post('/ssl/renew', authApi, SslController.renew);
router.post('/ssl/renew-all', authApi, SslController.renewAll);
router.post('/ssl/delete', authApi, SslController.delete);
router.get('/ssl/status', authApi, SslController.status);
router.post('/ssl/install', authApi, SslController.install);
router.post('/ssl/auto-renew', authApi, SslController.toggleAutoRenew);

router.get('/database/databases', authApi, DatabaseController.listDatabases);
router.get('/database/tables', authApi, DatabaseController.listTables);
router.get('/database/table-info', authApi, DatabaseController.getTableInfo);
router.post('/database/create-db', authApi, DatabaseController.createDatabase);
router.post('/database/delete-db', authApi, DatabaseController.deleteDatabase);
router.post('/database/create-user', authApi, DatabaseController.createUser);
router.post('/database/delete-user', authApi, DatabaseController.deleteUser);
router.post('/database/grant', authApi, DatabaseController.grantPrivileges);
router.post('/database/revoke', authApi, DatabaseController.revokePrivileges);

router.post('/mail/send', authApi, require('../controllers/MailController').send);
router.get('/mail/:uid', authApi, require('../controllers/MailController').getEmail);
router.post('/mail/delete', authApi, require('../controllers/MailController').deleteEmail);
router.post('/mail/seen', authApi, require('../controllers/MailController').markSeen);

const EmailAccountController = require('../controllers/EmailAccountController');
router.get('/email-accounts/list', authApi, EmailAccountController.listAccounts);
router.post('/email-accounts/create', authApi, EmailAccountController.createAccount);
router.post('/email-accounts/delete', authApi, EmailAccountController.deleteAccount);
router.post('/email-accounts/password', authApi, EmailAccountController.changePassword);
router.post('/email-accounts/toggle', authApi, EmailAccountController.toggleAccount);
router.post('/email-accounts/quota', authApi, EmailAccountController.updateQuota);

const DnsController = require('../controllers/DnsController');
router.get('/dns/zones', authApi, DnsController.getZoneRecords);
router.post('/dns/create-zone', authApi, DnsController.createZone);
router.post('/dns/delete-zone', authApi, DnsController.deleteZone);
router.post('/dns/add-record', authApi, DnsController.addRecord);
router.post('/dns/delete-record', authApi, DnsController.deleteRecord);
router.post('/dns/import', authApi, DnsController.importFromWebsite);

const PhpController = require('../controllers/PhpController');
router.post('/php/restart', authApi, PhpController.restart);
router.get('/php/modules', authApi, PhpController.getModules);
router.get('/php/info', authApi, PhpController.getInfo);

const ServerController = require('../controllers/ServerController');
router.post('/server/restart', authApi, ServerController.restartService);
router.post('/server/stop', authApi, ServerController.stopService);
router.get('/server/stats', authApi, ServerController.getStats);

const InstallerController = require('../controllers/InstallerController');
router.post('/installer/wordpress/install', authApi, InstallerController.wordpressInstall);
router.post('/installer/wordpress/delete', authApi, InstallerController.wordpressDelete);
router.get('/installer/wordpress/info', authApi, InstallerController.wordpressInfo);

router.post('/installer/laravel/install', authApi, InstallerController.laravelInstall);
router.post('/installer/laravel/delete', authApi, InstallerController.laravelDelete);
router.get('/installer/laravel/info', authApi, InstallerController.laravelInfo);
router.post('/installer/laravel/clear-cache', authApi, InstallerController.laravelClearCache);
router.post('/installer/laravel/optimize', authApi, InstallerController.laravelOptimize);

router.post('/installer/phpbb/install', authApi, InstallerController.phpbbInstall);
router.post('/installer/phpbb/delete', authApi, InstallerController.phpbbDelete);

router.post('/installer/joomla/install', authApi, InstallerController.joomlaInstall);
router.post('/installer/joomla/delete', authApi, InstallerController.joomlaDelete);

const CronController = require('../controllers/CronController');
router.get('/cron/list', authApi, CronController.listJobs);
router.post('/cron/add', authApi, CronController.addJob);
router.post('/cron/update', authApi, CronController.updateJob);
router.post('/cron/delete', authApi, CronController.deleteJob);

const PhpMyAdminController = require('../controllers/PhpMyAdminController');
router.post('/phpmyadmin/install', authApi, PhpMyAdminController.install);
router.post('/phpmyadmin/delete', authApi, PhpMyAdminController.delete);

const SettingsController = require('../controllers/SettingsController');
router.post('/settings/mail', authApi, SettingsController.saveMailSettings);

const CacheController = require('../controllers/CacheController');
const authCache = require('../middleware/authCache');

router.get('/cache/auth', authCache, CacheController.auth);
router.get('/cache/dashboard', authCache, CacheController.dashboard);
router.get('/cache/page', authCache, CacheController.getPageCache);
router.post('/cache/page', authCache, CacheController.updatePageCache);
router.get('/cache/browser', authCache, CacheController.getBrowserCache);
router.post('/cache/browser', authCache, CacheController.updateBrowserCache);
router.get('/cache/object', authCache, CacheController.getObjectCache);
router.post('/cache/object', authCache, CacheController.updateObjectCache);
router.get('/cache/php', authCache, CacheController.getPhpSettings);
router.post('/cache/php', authCache, CacheController.updatePhpSettings);
router.get('/cache/minify', authCache, CacheController.getMinify);
router.post('/cache/minify', authCache, CacheController.updateMinify);
router.post('/cache/purge', authCache, CacheController.purge);

module.exports = router;
