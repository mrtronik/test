const DatabaseService = require('../services/DatabaseService');

exports.getPage = async (req, res) => {
    try {
        const databases = await DatabaseService.listDatabases();
        const users = await DatabaseService.listUsers();
        res.render('databases/index', { title: 'Database Manager', databases, users });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.listDatabases = async (req, res) => {
    try {
        const databases = await DatabaseService.listDatabases();
        res.json({ databases });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.listTables = async (req, res) => {
    try {
        const { database } = req.query;
        if (!database) return res.status(400).json({ error: 'Database required' });
        const tables = await DatabaseService.listTables(database);
        res.json({ tables });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getTableInfo = async (req, res) => {
    try {
        const { database, table } = req.query;
        if (!database || !table) return res.status(400).json({ error: 'Database and table required' });
        const info = await DatabaseService.getTableInfo(database, table);
        res.json(info);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createDatabase = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });
        await DatabaseService.createDatabase(name);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteDatabase = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });
        await DatabaseService.deleteDatabase(name);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { username, password, host } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        await DatabaseService.createUser(username, password, host);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { username, host } = req.body;
        if (!username) return res.status(400).json({ error: 'Username required' });
        await DatabaseService.deleteUser(username, host);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.grantPrivileges = async (req, res) => {
    try {
        const { username, database, host } = req.body;
        if (!username || !database) return res.status(400).json({ error: 'Username and database required' });
        await DatabaseService.grantPrivileges(username, database, host);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.revokePrivileges = async (req, res) => {
    try {
        const { username, database, host } = req.body;
        if (!username || !database) return res.status(400).json({ error: 'Username and database required' });
        await DatabaseService.revokePrivileges(username, database, host);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};
