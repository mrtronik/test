const WordpressService = require('../services/WordpressService');
const LaravelService = require('../services/LaravelService');
const PhpbbService = require('../services/PhpbbService');
const JoomlaService = require('../services/JoomlaService');
const db = require('../config/db');
const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

exports.wordpressPage = async (req, res) => {
    try {
        const [websites] = await db.query('SELECT * FROM websites ORDER BY domain');

        for (const site of websites) {
            const docRoot = site.document_root || `/home/public_html/${site.domain}`;
            site.wpInstalled = WordpressService.isInstalled(docRoot);
            site.wpVersion = site.wpInstalled ? WordpressService.getInstalledVersion(docRoot) : null;
        }

        res.render('installer/wordpress', {
            title: 'WordPress Installer',
            websites
        });
    } catch (err) {
        console.error(err);
        res.render('installer/wordpress', { title: 'WordPress Installer', websites: [] });
    }
};

exports.wordpressInstall = async (req, res) => {
    try {
        const { domain, siteName, adminUser, adminPassword, adminEmail, dbName, dbUser, dbPassword, installCache } = req.body;

        if (!domain || !siteName || !adminUser || !adminPassword || !adminEmail) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const docRoot = `/home/public_html/${domain}`;
        const siteUrl = `http://${domain}`;

        let finalDbName = dbName || `wp_${domain.replace(/\./g, '_')}`;
        let finalDbUser = dbUser || finalDbName;
        let finalDbPassword = dbPassword || require('crypto').randomBytes(16).toString('hex');

        // Drop old database and user for clean install
        try {
            await db.query(`DROP DATABASE IF EXISTS \`${finalDbName}\``);
            await db.query(`DROP USER IF EXISTS '${finalDbUser}'@'localhost'`);
            await db.query('FLUSH PRIVILEGES');
        } catch (e) {}

        // Create database
        const dbErrors = [];
        try {
            await db.query(`CREATE DATABASE \`${finalDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        } catch (e) {
            dbErrors.push('CREATE DB: ' + e.message);
        }

        // Create user (drop first to avoid duplicate)
        try {
            await db.query(`DROP USER IF EXISTS '${finalDbUser}'@'localhost'`);
            await db.query(`CREATE USER '${finalDbUser}'@'localhost' IDENTIFIED BY '${finalDbPassword}'`);
            await db.query(`ALTER USER '${finalDbUser}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${finalDbPassword}'`);
        } catch (e) {
            dbErrors.push('CREATE USER: ' + e.message);
        }

        // Grant privileges
        try {
            await db.query(`GRANT ALL PRIVILEGES ON \`${finalDbName}\`.* TO '${finalDbUser}'@'localhost'`);
            await db.query('FLUSH PRIVILEGES');
        } catch (e) {
            dbErrors.push('GRANT: ' + e.message);
        }

        // Verify user can connect
        const mysql2 = require('mysql2/promise');
        const testConn = await mysql2.createConnection({
            host: 'localhost',
            user: finalDbUser,
            password: finalDbPassword,
            database: finalDbName
        });
        try {
            await testConn.query('SELECT 1');
        } catch (e) {
            await testConn.end();
            return res.status(500).json({ error: 'DB user cannot connect: ' + e.message, details: dbErrors });
        }
        await testConn.end();

        const result = await WordpressService.installWordPress(docRoot, siteUrl, {
            siteName,
            adminUser,
            adminPassword,
            adminEmail,
            dbName: finalDbName,
            dbUser: finalDbUser,
            dbPassword: finalDbPassword,
            dbHost: 'localhost'
        });

        // Fix OLS rewrite rules for WordPress
        const WebsiteService = require('../services/WebsiteService');
        await WebsiteService.fixExistingVhost(domain);
        WebsiteService.reloadOLS();

        // Auto-install MR Panel Cache plugin (only if requested)
        const cacheApiKey = crypto.randomBytes(32).toString('hex');
        let cacheInstalled = false;
        let cacheError = null;

        if (installCache !== false) {
            try {
                const pluginSource = '/opt/mrpanel/plugins/mr-panel-cache';
                const pluginDest = `${docRoot}/wp-content/plugins/mr-panel-cache`;

                if (!fs.existsSync(pluginSource)) {
                    cacheError = 'Plugin source not found at ' + pluginSource;
                    console.error('MR Panel Cache:', cacheError);
                } else {
                    const wpCliGlobal = '/usr/local/bin/wp';
                    if (!fs.existsSync(wpCliGlobal)) {
                        cacheError = 'WP-CLI not found at ' + wpCliGlobal;
                        console.error('MR Panel Cache:', cacheError);
                    } else {
                        // Copy plugin files
                        execSync(`cp -r "${pluginSource}" "${pluginDest}"`, { timeout: 15000 });
                        execSync(`chown -R lsadm:nogroup "${pluginDest}"`, { timeout: 10000 });

                        const panelDomain = req.headers.host || 'localhost:3000';
                        const protocol = req.headers['x-forwarded-proto'] || 'http';
                        const apiUrl = `${protocol}://${panelDomain}/api/cache`;

                        execSync(`${wpCliGlobal} option update mrp_api_url "${apiUrl}" --path="${docRoot}" --allow-root`, { encoding: 'utf8', timeout: 15000 });
                        execSync(`${wpCliGlobal} option update mrp_api_key "${cacheApiKey}" --path="${docRoot}" --allow-root`, { encoding: 'utf8', timeout: 15000 });
                        execSync(`${wpCliGlobal} option update mrp_domain "${domain}" --path="${docRoot}" --allow-root`, { encoding: 'utf8', timeout: 15000 });
                        execSync(`${wpCliGlobal} plugin activate mr-panel-cache --path="${docRoot}" --allow-root`, { encoding: 'utf8', timeout: 15000 });

                        cacheInstalled = true;
                    }
                }
            } catch (e) {
                cacheError = e.message;
                console.error('MR Panel Cache plugin install failed:', e.message);
            }
        }

        // Save cache API key to database
        try {
            await db.query('UPDATE websites SET cache_api_key = ? WHERE domain = ?', [cacheApiKey, domain]);
        } catch (e) {
            // Website might not exist in DB yet, skip
        }

        res.json({
            ...result,
            db: { name: finalDbName, user: finalDbUser, password: finalDbPassword },
            cache: { installed: cacheInstalled, api_key: cacheApiKey, error: cacheError }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

exports.wordpressDelete = async (req, res) => {
    try {
        const { domain } = req.body;
        if (!domain) return res.status(400).json({ error: 'Domain required' });

        const docRoot = `/home/public_html/${domain}`;

        // Try to find and drop the database
        const dbName = `wp_${domain.replace(/\./g, '_')}`;
        try {
            await db.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
            await db.query(`DROP USER IF EXISTS '${dbName}'@'localhost'`);
            await db.query('FLUSH PRIVILEGES');
        } catch (e) {
            console.log('DB cleanup note:', e.message);
        }

        // Also try to read wp-config.php for actual DB name before dropping
        try {
            const wpConfig = require('fs').readFileSync(`${docRoot}/wp-config.php`, 'utf8');
            const dbNameMatch = wpConfig.match(/define\s*\(\s*'DB_NAME'\s*,\s*'([^']+)'/);
            const dbUserMatch = wpConfig.match(/define\s*\(\s*'DB_USER'\s*,\s*'([^']+)'/);
            if (dbNameMatch && dbNameMatch[1] !== dbName) {
                await db.query(`DROP DATABASE IF EXISTS \`${dbNameMatch[1]}\``);
            }
            if (dbUserMatch && dbUserMatch[1] !== dbName) {
                await db.query(`DROP USER IF EXISTS '${dbUserMatch[1]}'@'localhost'`);
                await db.query('FLUSH PRIVILEGES');
            }
        } catch (e) {}

        const result = WordpressService.removeWp(docRoot);

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.wordpressInfo = async (req, res) => {
    try {
        const { domain } = req.query;
        const docRoot = `/home/public_html/${domain}`;

        res.json({
            installed: WordpressService.isInstalled(docRoot),
            version: WordpressService.getInstalledVersion(docRoot),
            plugins: WordpressService.listPlugins(docRoot),
            themes: WordpressService.listThemes(docRoot)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Laravel Installer
exports.laravelPage = async (req, res) => {
    try {
        const [websites] = await db.query('SELECT * FROM websites ORDER BY domain');

        for (const site of websites) {
            const docRoot = site.document_root || `/home/public_html/${site.domain}`;
            site.laravelInstalled = LaravelService.isInstalled(docRoot);
            site.laravelVersion = site.laravelInstalled ? LaravelService.getVersion(docRoot) : null;
        }

        res.render('installer/laravel', {
            title: 'Laravel Installer',
            websites
        });
    } catch (err) {
        console.error(err);
        res.render('installer/laravel', { title: 'Laravel Installer', websites: [] });
    }
};

exports.laravelInstall = async (req, res) => {
    try {
        const { domain, appName, dbName, dbUser, dbPassword, repoUrl } = req.body;

        if (!domain) {
            return res.status(400).json({ error: 'Domain is required' });
        }

        const docRoot = `/home/public_html/${domain}`;

        let finalDbName = dbName || `laravel_${domain.replace(/\./g, '_')}`;
        let finalDbUser = dbUser || finalDbName;
        let finalDbPassword = dbPassword || require('crypto').randomBytes(16).toString('hex');

        // Create DB
        try {
            await db.query(`CREATE DATABASE IF NOT EXISTS \`${finalDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            await db.query(`CREATE USER IF NOT EXISTS '${finalDbUser}'@'localhost' IDENTIFIED BY '${finalDbPassword}'`);
            await db.query(`GRANT ALL PRIVILEGES ON \`${finalDbName}\`.* TO '${finalDbUser}'@'localhost'`);
            await db.query('FLUSH PRIVILEGES');
        } catch (dbErr) {
            console.log('DB creation note:', dbErr.message);
        }

        const result = await LaravelService.installLaravel(docRoot, {
            appName: appName || 'Laravel',
            domain,
            dbName: finalDbName,
            dbUser: finalDbUser,
            dbPassword: finalDbPassword,
            repoUrl
        });

        res.json({
            ...result,
            db: { name: finalDbName, user: finalDbUser, password: finalDbPassword }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

exports.laravelDelete = async (req, res) => {
    try {
        const { domain } = req.body;
        if (!domain) return res.status(400).json({ error: 'Domain required' });

        const docRoot = `/home/public_html/${domain}`;
        const result = LaravelService.removeLaravel(docRoot);

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.laravelInfo = async (req, res) => {
    try {
        const { domain } = req.query;
        const docRoot = `/home/public_html/${domain}`;

        res.json({
            installed: LaravelService.isInstalled(docRoot),
            version: LaravelService.getVersion(docRoot)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.laravelClearCache = async (req, res) => {
    try {
        const { domain } = req.body;
        const docRoot = `/home/public_html/${domain}`;
        const result = LaravelService.clearCache(docRoot);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.laravelOptimize = async (req, res) => {
    try {
        const { domain } = req.body;
        const docRoot = `/home/public_html/${domain}`;
        const result = LaravelService.optimize(docRoot);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// phpBB Installer
exports.phpbbPage = async (req, res) => {
    try {
        const [websites] = await db.query('SELECT * FROM websites ORDER BY domain');
        for (const site of websites) {
            const docRoot = site.document_root || `/home/public_html/${site.domain}`;
            site.phpbbInstalled = PhpbbService.isInstalled(docRoot);
            site.phpbbVersion = site.phpbbInstalled ? PhpbbService.getVersion(docRoot) : null;
        }
        res.render('installer/phpbb', { title: 'phpBB Installer', websites });
    } catch (err) {
        res.render('installer/phpbb', { title: 'phpBB Installer', websites: [] });
    }
};

exports.phpbbInstall = async (req, res) => {
    try {
        const { domain, siteName, dbName, dbUser, dbPassword } = req.body;
        if (!domain) return res.status(400).json({ error: 'Domain is required' });

        const docRoot = `/home/public_html/${domain}`;
        let finalDbName = dbName || `phpbb_${domain.replace(/\./g, '_')}`;
        let finalDbUser = dbUser || finalDbName;
        let finalDbPassword = dbPassword || require('crypto').randomBytes(16).toString('hex');

        try {
            await db.query(`CREATE DATABASE IF NOT EXISTS \`${finalDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            await db.query(`CREATE USER IF NOT EXISTS '${finalDbUser}'@'localhost' IDENTIFIED BY '${finalDbPassword}'`);
            await db.query(`GRANT ALL PRIVILEGES ON \`${finalDbName}\`.* TO '${finalDbUser}'@'localhost'`);
            await db.query('FLUSH PRIVILEGES');
        } catch (dbErr) {
            console.log('DB creation note:', dbErr.message);
        }

        await PhpbbService.downloadAndExtract(docRoot);
        PhpbbService.createConfig(docRoot, {
            dbName: finalDbName,
            dbUser: finalDbUser,
            dbPassword: finalDbPassword,
            dbHost: 'localhost'
        });

        try {
            execSync(`chown -R lsadm:nogroup "${docRoot}" 2>/dev/null || true`, { stdio: 'ignore' });
        } catch {}

        res.json({
            success: true,
            method: 'browser',
            message: 'phpBB files installed. Complete installation by visiting the install page.',
            installUrl: `http://${domain}/install/`,
            db: { name: finalDbName, user: finalDbUser, password: finalDbPassword }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.phpbbDelete = async (req, res) => {
    try {
        const { domain } = req.body;
        if (!domain) return res.status(400).json({ error: 'Domain required' });
        res.json(PhpbbService.removePhpbb(`/home/public_html/${domain}`));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Joomla Installer
exports.joomlaPage = async (req, res) => {
    try {
        const [websites] = await db.query('SELECT * FROM websites ORDER BY domain');
        for (const site of websites) {
            const docRoot = site.document_root || `/home/public_html/${site.domain}`;
            site.joomlaInstalled = JoomlaService.isInstalled(docRoot);
            site.joomlaVersion = site.joomlaInstalled ? JoomlaService.getVersion(docRoot) : null;
        }
        res.render('installer/joomla', { title: 'Joomla Installer', websites });
    } catch (err) {
        res.render('installer/joomla', { title: 'Joomla Installer', websites: [] });
    }
};

exports.joomlaInstall = async (req, res) => {
    try {
        const { domain, siteName, dbName, dbUser, dbPassword } = req.body;
        if (!domain) return res.status(400).json({ error: 'Domain is required' });

        const docRoot = `/home/public_html/${domain}`;
        let finalDbName = dbName || `joomla_${domain.replace(/\./g, '_')}`;
        let finalDbUser = dbUser || finalDbName;
        let finalDbPassword = dbPassword || require('crypto').randomBytes(16).toString('hex');

        try {
            await db.query(`CREATE DATABASE IF NOT EXISTS \`${finalDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            await db.query(`CREATE USER IF NOT EXISTS '${finalDbUser}'@'localhost' IDENTIFIED BY '${finalDbPassword}'`);
            await db.query(`GRANT ALL PRIVILEGES ON \`${finalDbName}\`.* TO '${finalDbUser}'@'localhost'`);
            await db.query('FLUSH PRIVILEGES');
        } catch (dbErr) {
            console.log('DB creation note:', dbErr.message);
        }

        await JoomlaService.downloadAndExtract(docRoot);
        JoomlaService.createConfiguration(docRoot, {
            siteName: siteName || 'Joomla Site',
            dbName: finalDbName,
            dbUser: finalDbUser,
            dbPassword: finalDbPassword,
            dbHost: 'localhost'
        });

        try {
            execSync(`chown -R lsadm:nogroup "${docRoot}" 2>/dev/null || true`, { stdio: 'ignore' });
            execSync(`chmod -R 755 "${docRoot}/tmp" "${docRoot}/administrator/logs" 2>/dev/null || true`, { stdio: 'ignore' });
        } catch {}

        res.json({
            success: true,
            method: 'browser',
            message: 'Joomla files installed. Complete installation by visiting the site.',
            installUrl: `http://${domain}/installation/`,
            db: { name: finalDbName, user: finalDbUser, password: finalDbPassword }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.joomlaDelete = async (req, res) => {
    try {
        const { domain } = req.body;
        if (!domain) return res.status(400).json({ error: 'Domain required' });
        res.json(JoomlaService.removeJoomla(`/home/public_html/${domain}`));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
