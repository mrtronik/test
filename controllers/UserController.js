const UserService = require('../services/UserService');
const fs = require('fs').promises;

exports.listUsers = async (req, res) => {
    try {
        const users = await UserService.listAll();
        res.render('users/index', { title: 'User Management', users, formatSize: UserService.formatSize });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.addForm = async (req, res) => {
    try {
        const packages = await UserService.listPackages();
        res.render('users/add', { title: 'Add User', packages, formatSize: UserService.formatSize, error: null });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.create = async (req, res) => {
    try {
        const { name, username, email, password, role, package_id, status } = req.body;

        const existing = await UserService.findByUsername(username);
        if (existing) {
            const packages = await UserService.listPackages();
            return res.render('users/add', { title: 'Add User', packages, error: 'Username already exists' });
        }

        const existingEmail = await UserService.findByEmail(email);
        if (existingEmail) {
            const packages = await UserService.listPackages();
            return res.render('users/add', { title: 'Add User', packages, error: 'Email already exists' });
        }

        const userId = await UserService.create({ name, username, email, password, role, package_id, status });

        const homeDir = `/home/${username}`;
        await fs.mkdir(homeDir, { recursive: true });
        await fs.mkdir(`${homeDir}/public_html`, { recursive: true });

        res.redirect('/users');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.editForm = async (req, res) => {
    try {
        const user = await UserService.findById(req.params.id);
        if (!user) return res.redirect('/users');
        const packages = await UserService.listPackages();
        res.render('users/edit', { title: 'Edit User', user, packages, formatSize: UserService.formatSize, error: null });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.update = async (req, res) => {
    try {
        const { name, username, email, password, role, package_id, status } = req.body;
        const updateData = { name, username, email, role, package_id: package_id || null, status: status || 'active' };
        if (password) updateData.password = password;

        await UserService.update(req.params.id, updateData);
        res.redirect('/users');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.suspend = async (req, res) => {
    try {
        await UserService.update(req.params.id, { status: 'suspended' });
        res.redirect('/users');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.activate = async (req, res) => {
    try {
        await UserService.update(req.params.id, { status: 'active' });
        res.redirect('/users');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.delete = async (req, res) => {
    try {
        const user = await UserService.findById(req.params.id);
        if (user && user.role === 'admin') {
            return res.redirect('/users');
        }
        await UserService.delete(req.params.id);
        res.redirect('/users');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.packages = async (req, res) => {
    try {
        const packages = await UserService.listPackages();
        res.render('users/packages', { title: 'Packages', packages, formatSize: UserService.formatSize, error: null });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.createPackage = async (req, res) => {
    try {
        const { name, disk_limit, bandwidth_limit, max_domains, max_email, max_database, price } = req.body;
        await UserService.createPackage({
            name,
            disk_limit: parseInt(disk_limit) * 1073741824,
            bandwidth_limit: parseInt(bandwidth_limit) * 1073741824,
            max_domains: parseInt(max_domains),
            max_email: parseInt(max_email),
            max_database: parseInt(max_database),
            price: parseFloat(price)
        });
        res.redirect('/packages');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.deletePackage = async (req, res) => {
    try {
        await UserService.deletePackage(req.params.id);
        res.redirect('/packages');
    } catch (err) {
        const packages = await UserService.listPackages();
        res.render('users/packages', { title: 'Packages', packages, formatSize: UserService.formatSize, error: err.message });
    }
};
