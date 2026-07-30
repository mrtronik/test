const PhpService = require('../services/PhpService');

exports.getPage = async (req, res) => {
    try {
        const version = PhpService.getVersion();
        const modules = PhpService.getModules();
        const iniSettings = PhpService.getIniSettings();
        const fpmPools = PhpService.getFpmPools();
        const fpmVersion = PhpService.getFpmVersion();
        const installedVersions = PhpService.getInstalledVersions();
        const serviceStatus = PhpService.getServiceStatus();
        const opcache = PhpService.getOpCacheStatus();
        const iniPath = PhpService.getPhpIniPath();

        res.render('php/index', {
            title: 'PHP Manager',
            version,
            modules,
            iniSettings,
            fpmPools,
            fpmVersion,
            installedVersions,
            serviceStatus,
            opcache,
            iniPath
        });
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
};

exports.restart = async (req, res) => {
    try {
        const result = PhpService.restartFpm();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getModules = async (req, res) => {
    try {
        const modules = PhpService.getModules();
        res.json({ success: true, modules });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getInfo = async (req, res) => {
    try {
        const info = PhpService.getInfo();
        res.json({ success: true, info });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
