const express = require('express');
const router = express.Router();

const HomeController = require('../controllers/HomeController');
const AuthController = require('../controllers/AuthController');
const DashboardController = require('../controllers/DashboardController');
const PageController = require('../controllers/PageController');
const WebsiteController = require('../controllers/WebsiteController');
const FileManagerController = require('../controllers/FileManagerController');
const UserController = require('../controllers/UserController');
const SslController = require('../controllers/SslController');
const DatabaseController = require('../controllers/DatabaseController');
const auth = require('../middleware/auth');
const imap = require("../imap");

const MailController = require("../controllers/MailController");
const EmailAccountController = require("../controllers/EmailAccountController");
const DnsController = require("../controllers/DnsController");
const PhpController = require("../controllers/PhpController");
const ServerController = require("../controllers/ServerController");
const ServiceController = require('../controllers/ServiceController');
const CronController = require('../controllers/CronController');
const PhpMyAdminController = require('../controllers/PhpMyAdminController');

router.get("/mail/inbox", auth, MailController.inbox);
router.get("/mail/email/:uid", auth, MailController.detail);
router.get("/mail/latest", auth, MailController.latest);
router.get("/mail/compose", auth, MailController.composeForm);
router.get("/mail/reply/:uid", auth, MailController.replyForm);
router.get("/webmail/login", MailController.webmailLogin);
router.post("/webmail/auth", MailController.webmailAuth);
router.get("/webmail/auto", MailController.webmailAutoLogin);
router.get("/webmail/logout", MailController.webmailLogout);
router.get("/webmail", MailController.webmail);

router.get('/', HomeController.index);
router.get('/about', HomeController.about);
router.get('/login', AuthController.loginForm);
router.post('/login', AuthController.login);
router.get('/logout', AuthController.logout);
router.get('/dashboard', auth, DashboardController.index);
router.get('/server/services', auth, ServiceController.index);

// Account Manager
router.get('/websites', auth, WebsiteController.index);
router.get('/websites/add', auth, WebsiteController.addForm);
router.post('/websites', auth, WebsiteController.create);
router.get('/websites/:id', auth, WebsiteController.detail);
router.post('/websites/:id/suspend', auth, WebsiteController.suspend);
router.post('/websites/:id/activate', auth, WebsiteController.activate);
router.post('/websites/:id/delete', auth, WebsiteController.delete);
router.get('/users', auth, UserController.listUsers);
router.get('/users/add', auth, UserController.addForm);
router.post('/users', auth, UserController.create);
router.get('/users/:id/edit', auth, UserController.editForm);
router.post('/users/:id/edit', auth, UserController.update);
router.post('/users/:id/suspend', auth, UserController.suspend);
router.post('/users/:id/activate', auth, UserController.activate);
router.post('/users/:id/delete', auth, UserController.delete);
router.get('/databases', auth, DatabaseController.getPage);
router.get('/dns', auth, DnsController.getPage);
router.get('/ssl', auth, SslController.getPage);
router.get('/email-accounts', auth, EmailAccountController.getPage);

// System Info & File
router.get('/file-manager', auth, FileManagerController.getPage);
router.get('/system-info', auth, PageController.systemInfo);
router.get('/php-settings', auth, PhpController.getPage);
router.get('/terminal', auth, PageController.terminal);

// Extra Feature
router.get('/phpmyadmin', auth, PhpMyAdminController.getPage);

// MR Apps Installer
const InstallerController = require('../controllers/InstallerController');
router.get('/installer/wordpress', auth, InstallerController.wordpressPage);
router.get('/installer/laravel', auth, InstallerController.laravelPage);
router.get('/installer/phpbb', auth, InstallerController.phpbbPage);
router.get('/installer/joomla', auth, InstallerController.joomlaPage);

// Settings
const SettingsController = require('../controllers/SettingsController');
router.get('/settings/server', auth, ServerController.getPage);
router.get('/settings/php', auth, PhpController.getPage);
router.get('/settings/mail', auth, SettingsController.getMailPage);

// Cron Jobs
router.get('/cron', auth, CronController.getPage);

// Packages
router.get('/packages', auth, UserController.packages);
router.post('/packages', auth, UserController.createPackage);
router.post('/packages/:id/delete', auth, UserController.deletePackage);

module.exports = router;
