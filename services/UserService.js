const db = require('../config/db');
const bcrypt = require('bcrypt');

class UserService {

    static async listAll() {
        const [rows] = await db.execute(
            'SELECT u.*, p.name as package_name, p.disk_limit, p.bandwidth_limit FROM users u LEFT JOIN packages p ON u.package_id = p.id ORDER BY u.created_at DESC'
        );
        return rows;
    }

    static async findById(id) {
        const [rows] = await db.execute(
            'SELECT u.*, p.name as package_name FROM users u LEFT JOIN packages p ON u.package_id = p.id WHERE u.id = ?',
            [id]
        );
        return rows[0] || null;
    }

    static async findByUsername(username) {
        const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        return rows[0] || null;
    }

    static async findByEmail(email) {
        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        return rows[0] || null;
    }

    static async create(data) {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const homeDir = data.home_dir || `/home/${data.username}`;

        const [result] = await db.execute(
            'INSERT INTO users (name, username, email, password, role, status, home_dir, package_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [data.name, data.username, data.email, hashedPassword, data.role || 'user', data.status || 'active', homeDir, data.package_id || null]
        );

        return result.insertId;
    }

    static async update(id, data) {
        const fields = [];
        const values = [];

        if (data.name) { fields.push('name = ?'); values.push(data.name); }
        if (data.username) { fields.push('username = ?'); values.push(data.username); }
        if (data.email) { fields.push('email = ?'); values.push(data.email); }
        if (data.role) { fields.push('role = ?'); values.push(data.role); }
        if (data.status) { fields.push('status = ?'); values.push(data.status); }
        if (data.package_id !== undefined) { fields.push('package_id = ?'); values.push(data.package_id || null); }
        if (data.password) {
            const hashed = await bcrypt.hash(data.password, 10);
            fields.push('password = ?');
            values.push(hashed);
        }

        if (fields.length === 0) return false;

        values.push(id);
        await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
        return true;
    }

    static async delete(id) {
        await db.execute('DELETE FROM users WHERE id = ? AND role != "admin"', [id]);
        return true;
    }

    static async updateLastLogin(id) {
        await db.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [id]);
    }

    static async countByRole(role) {
        const [rows] = await db.execute('SELECT COUNT(*) as cnt FROM users WHERE role = ?', [role]);
        return rows[0].cnt;
    }

    static async listPackages() {
        const [rows] = await db.execute('SELECT * FROM packages ORDER BY price ASC');
        return rows;
    }

    static async findPackage(id) {
        const [rows] = await db.execute('SELECT * FROM packages WHERE id = ?', [id]);
        return rows[0] || null;
    }

    static async createPackage(data) {
        const [result] = await db.execute(
            'INSERT INTO packages (name, disk_limit, bandwidth_limit, max_domains, max_email, max_database, price) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [data.name, data.disk_limit || 1073741824, data.bandwidth_limit || 10737418240, data.max_domains || 10, data.max_email || 10, data.max_database || 10, data.price || 0]
        );
        return result.insertId;
    }

    static async updatePackage(id, data) {
        const fields = [];
        const values = [];

        if (data.name) { fields.push('name = ?'); values.push(data.name); }
        if (data.disk_limit !== undefined) { fields.push('disk_limit = ?'); values.push(data.disk_limit); }
        if (data.bandwidth_limit !== undefined) { fields.push('bandwidth_limit = ?'); values.push(data.bandwidth_limit); }
        if (data.max_domains !== undefined) { fields.push('max_domains = ?'); values.push(data.max_domains); }
        if (data.max_email !== undefined) { fields.push('max_email = ?'); values.push(data.max_email); }
        if (data.max_database !== undefined) { fields.push('max_database = ?'); values.push(data.max_database); }
        if (data.price !== undefined) { fields.push('price = ?'); values.push(data.price); }
        if (data.status) { fields.push('status = ?'); values.push(data.status); }

        if (fields.length === 0) return false;

        values.push(id);
        await db.execute(`UPDATE packages SET ${fields.join(', ')} WHERE id = ?`, values);
        return true;
    }

    static async deletePackage(id) {
        const [users] = await db.execute('SELECT COUNT(*) as cnt FROM users WHERE package_id = ?', [id]);
        if (users[0].cnt > 0) {
            throw new Error('Package is still in use by users');
        }
        await db.execute('DELETE FROM packages WHERE id = ?', [id]);
        return true;
    }

    static formatSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = UserService;
