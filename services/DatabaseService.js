const mysql = require('mysql2/promise');

class DatabaseService {

    static getPool() {
        return mysql.createPool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            waitForConnections: true,
            connectionLimit: 5
        });
    }

    static async listDatabases() {
        const pool = this.getPool();
        try {
            const [rows] = await pool.query('SHOW DATABASES');
            const skip = ['information_schema', 'performance_schema', 'mysql', 'sys'];
            return rows.filter(r => !skip.includes(r.Database)).map(r => r.Database);
        } finally {
            await pool.end();
        }
    }

    static async listTables(dbName) {
        const pool = this.getPool();
        try {
            await pool.query(`USE \`${dbName}\``);
            const [rows] = await pool.query('SHOW TABLES');
            const key = `Tables_in_${dbName}`;
            return rows.map(r => r[key]);
        } finally {
            await pool.end();
        }
    }

    static async getTableInfo(dbName, tableName) {
        const pool = this.getPool();
        try {
            await pool.query(`USE \`${dbName}\``);
            const [columns] = await pool.query(`DESCRIBE \`${tableName}\``);
            const [createTable] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
            const [rowCount] = await pool.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
            return {
                columns,
                createTable: createTable[0]['Create Table'],
                rowCount: rowCount[0].count
            };
        } finally {
            await pool.end();
        }
    }

    static async createDatabase(dbName) {
        const pool = this.getPool();
        try {
            await pool.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            return { success: true };
        } finally {
            await pool.end();
        }
    }

    static async deleteDatabase(dbName) {
        const pool = this.getPool();
        try {
            await pool.query(`DROP DATABASE \`${dbName}\``);
            return { success: true };
        } finally {
            await pool.end();
        }
    }

    static async listUsers() {
        const pool = this.getPool();
        try {
            const [rows] = await pool.query("SELECT User, Host FROM mysql.user WHERE User NOT IN ('root','mysql.sys','mysql.infoschema','mysql.session')");
            return rows.map(r => ({ user: r.User, host: r.Host }));
        } finally {
            await pool.end();
        }
    }

    static async createUser(username, password, host) {
        const pool = this.getPool();
        const h = host || '%';
        try {
            await pool.query(`CREATE USER \`${username}\`@\`${h}\` IDENTIFIED BY '${password.replace(/'/g, "\\'")}'`);
            return { success: true };
        } finally {
            await pool.end();
        }
    }

    static async deleteUser(username, host) {
        const pool = this.getPool();
        const h = host || '%';
        try {
            await pool.query(`DROP USER \`${username}\`@\`${h}\``);
            return { success: true };
        } finally {
            await pool.end();
        }
    }

    static async grantPrivileges(username, dbName, host) {
        const pool = this.getPool();
        const h = host || '%';
        try {
            await pool.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO \`${username}\`@\`${h}\``);
            await pool.query('FLUSH PRIVILEGES');
            return { success: true };
        } finally {
            await pool.end();
        }
    }

    static async revokePrivileges(username, dbName, host) {
        const pool = this.getPool();
        const h = host || '%';
        try {
            await pool.query(`REVOKE ALL PRIVILEGES ON \`${dbName}\`.* FROM \`${username}\`@\`${h}\``);
            await pool.query('FLUSH PRIVILEGES');
            return { success: true };
        } finally {
            await pool.end();
        }
    }

    static async getGrants(username, host) {
        const pool = this.getPool();
        const h = host || '%';
        try {
            const [rows] = await pool.query(`SHOW GRANTS FOR \`${username}\`@\`${h}\``);
            return rows.map(r => Object.values(r)[0]);
        } finally {
            await pool.end();
        }
    }
}

module.exports = DatabaseService;
