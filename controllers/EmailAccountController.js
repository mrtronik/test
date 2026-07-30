const EmailAccountService = require('../services/EmailAccountService');

// =========================
// Email Accounts Page
// =========================
exports.getPage = async (req, res) => {
    try {
        const domain = req.query.domain || '';
        const domains = await EmailAccountService.listDomains();
        const accounts = await EmailAccountService.listAccounts(domain);

        // Attach quota info
        for (const acc of accounts) {
            const quota = EmailAccountService.getQuota(acc.email);
            acc.usedFormatted = quota.usedFormatted;
            acc.usedBytes = quota.used;
            acc.quotaFormatted = acc.quota ? EmailAccountService._formatQuota(acc.quota) : 'Unlimited';
            acc.quotaPercent = acc.quota > 0 ? ((quota.used / acc.quota) * 100).toFixed(1) : 0;
        }

        res.render('mail/accounts', {
            title: 'Email Accounts',
            domains,
            accounts,
            selectedDomain: domain
        });
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
};

// =========================
// API: List Accounts
// =========================
exports.listAccounts = async (req, res) => {
    try {
        const domain = req.query.domain || '';
        const accounts = await EmailAccountService.listAccounts(domain);
        for (const acc of accounts) {
            const quota = EmailAccountService.getQuota(acc.email);
            acc.usedFormatted = quota.usedFormatted;
            acc.quotaFormatted = acc.quota ? EmailAccountService._formatQuota(acc.quota) : 'Unlimited';
        }
        res.json({ success: true, accounts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// =========================
// API: Create Account
// =========================
exports.createAccount = async (req, res) => {
    try {
        const { email, password, domain, quota } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const result = await EmailAccountService.createAccount(email, password, domain, quota);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// =========================
// API: Delete Account
// =========================
exports.deleteAccount = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        const result = await EmailAccountService.deleteAccount(email);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// =========================
// API: Change Password
// =========================
exports.changePassword = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const result = await EmailAccountService.changePassword(email, password);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// =========================
// API: Toggle Account
// =========================
exports.toggleAccount = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        const result = await EmailAccountService.toggleAccount(email);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// =========================
// API: Update Quota
// =========================
exports.updateQuota = async (req, res) => {
    try {
        const { email, quota } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        const result = await EmailAccountService.updateQuota(email, parseInt(quota) || 0);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
