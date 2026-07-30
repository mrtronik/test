const WebmailImap = require("../services/WebmailImap");
const { sendMail, verifyConnection } = require("../services/EmailService");
const db = require("../config/db");

// =========================
// Inbox (legacy → redirect to webmail)
// =========================
exports.inbox = async (req, res) => {
    res.redirect("/webmail");
};

// =========================
// Webmail - Login Page
// =========================
exports.webmailLogin = (req, res) => {
    res.render("mail/webmail-login", {
        title: 'Webmail Login',
        error: req.query.error || '',
        email: req.query.email || ''
    });
};

// =========================
// Webmail - Auth (POST)
// =========================
exports.webmailAuth = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.render("mail/webmail-login", {
            title: 'Webmail Login',
            error: 'Email and password are required',
            email: email || ''
        });
    }

    // Validate domain must exist in websites table
    const domain = email.split('@')[1];
    if (!domain) {
        return res.render("mail/webmail-login", {
            title: 'Webmail Login',
            error: 'Invalid email format',
            email: email
        });
    }

    try {
        const [rows] = await db.query('SELECT domain FROM websites WHERE domain = ?', [domain]);
        if (rows.length === 0) {
            return res.render("mail/webmail-login", {
                title: 'Webmail Login',
                error: 'Domain "' + domain + '" is not registered on this server',
                email: email
            });
        }
    } catch (err) {
        return res.render("mail/webmail-login", {
            title: 'Webmail Login',
            error: 'Database error: ' + err.message,
            email: email
        });
    }

    const session = {
        userEmail: email,
        userPassword: password,
        imapHost: domain,
        imapPort: 993,
        imapSecure: true
    };

    const test = await WebmailImap.testConnection(session);
    if (!test.success) {
        return res.render("mail/webmail-login", {
            title: 'Webmail Login',
            error: 'Connection failed: ' + test.error,
            email: email
        });
    }

    req.session.userEmail = session.userEmail;
    req.session.userPassword = session.userPassword;
    req.session.imapHost = session.imapHost;
    req.session.imapPort = session.imapPort;
    req.session.imapSecure = session.imapSecure;
    req.session.smtpHost = session.imapHost;
    req.session.smtpPort = 25;
    req.session.smtpSecure = false;

    res.redirect("/webmail");
};

// =========================
// Webmail - Auto Login (from email accounts)
// =========================
exports.webmailAutoLogin = async (req, res) => {
    const { email } = req.query;
    if (!email) return res.redirect("/webmail/login?error=No email specified");

    const password = req.query.password;
    if (!password) return res.redirect("/webmail/login?error=No password provided");

    // Validate domain
    const domain = email.split('@')[1];
    if (!domain) return res.redirect("/webmail/login?error=Invalid email format");

    try {
        const [rows] = await db.query('SELECT domain FROM websites WHERE domain = ?', [domain]);
        if (rows.length === 0) {
            return res.redirect("/webmail/login?error=" + encodeURIComponent('Domain "' + domain + '" is not registered'));
        }
    } catch (err) {
        return res.redirect("/webmail/login?error=" + encodeURIComponent(err.message));
    }

    const mailHost = req.query.host || domain;
    const session = {
        userEmail: email,
        userPassword: password,
        imapHost: mailHost,
        imapPort: parseInt(req.query.port) || 993,
        imapSecure: req.query.secure !== 'false'
    };

    const test = await WebmailImap.testConnection(session);
    if (!test.success) {
        return res.redirect("/webmail/login?error=" + encodeURIComponent(test.error) + "&email=" + encodeURIComponent(email));
    }

    req.session.userEmail = session.userEmail;
    req.session.userPassword = session.userPassword;
    req.session.imapHost = session.imapHost;
    req.session.imapPort = session.imapPort;
    req.session.imapSecure = session.imapSecure;
    req.session.smtpHost = session.imapHost;
    req.session.smtpPort = 25;
    req.session.smtpSecure = false;

    res.redirect("/webmail");
};

// =========================
// Webmail - Logout
// =========================
exports.webmailLogout = (req, res) => {
    delete req.session.userEmail;
    delete req.session.userPassword;
    delete req.session.imapHost;
    delete req.session.imapPort;
    delete req.session.imapSecure;
    delete req.session.smtpHost;
    delete req.session.smtpPort;
    delete req.session.smtpSecure;
    res.redirect("/webmail/login");
};

// =========================
// Webmail - Inbox (main page)
// =========================
exports.webmail = async (req, res) => {
    if (!req.session.userEmail) {
        return res.redirect("/webmail/login");
    }

    try {
        const emails = await WebmailImap.getInbox(req.session);
        res.render("mail/webmail", {
            title: 'Webmail',
            emails,
            currentUser: req.session.userEmail
        });
    } catch (err) {
        console.log(err);
        delete req.session.userEmail;
        delete req.session.userPassword;
        res.redirect("/webmail/login?error=" + encodeURIComponent("Session expired: " + err.message));
    }
};

// =========================
// API: Get Email by UID
// =========================
exports.getEmail = async (req, res) => {
    try {
        if (!req.session.userEmail) return res.status(401).json({ error: 'Not authenticated' });
        const email = await WebmailImap.getEmail(req.session, req.params.uid);
        await WebmailImap.markSeen(req.session, req.params.uid);
        res.json({
            success: true,
            email: {
                uid: email.uid,
                from: email.from ? email.from.text : '',
                to: email.to ? email.to.text : '',
                subject: email.subject || '(No Subject)',
                date: email.date,
                text: email.text || '',
                html: email.html || ''
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// =========================
// API: Delete Email
// =========================
exports.deleteEmail = async (req, res) => {
    try {
        if (!req.session.userEmail) return res.status(401).json({ error: 'Not authenticated' });
        const { uid } = req.body;
        if (!uid) return res.status(400).json({ error: 'UID required' });
        await WebmailImap.deleteEmail(req.session, uid);
        const io = require('../socket').getIO();
        if (io) io.emit('email-deleted', { uid });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// =========================
// API: Mark Seen/Unseen
// =========================
exports.markSeen = async (req, res) => {
    try {
        if (!req.session.userEmail) return res.status(401).json({ error: 'Not authenticated' });
        const { uid, seen } = req.body;
        if (!uid) return res.status(400).json({ error: 'UID required' });
        if (seen) {
            await WebmailImap.markSeen(req.session, uid);
        } else {
            await WebmailImap.markUnseen(req.session, uid);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// =========================
// Detail Email (legacy page)
// =========================
exports.detail = async (req, res) => {
    try {
        if (!req.session.userEmail) return res.redirect("/webmail/login");
        const email = await WebmailImap.getEmail(req.session, req.params.uid);
        res.render("mail/detail", { title: 'Email Detail', email, uid: req.params.uid });
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
};

// =========================
// Compose Form
// =========================
exports.composeForm = async (req, res) => {
    const { to, subject } = req.query;
    res.render("mail/compose", {
        title: 'Compose Email',
        from: req.query.from || 'inbox',
        prefill: { to: to || '', subject: subject || '', body: '' }
    });
};

// =========================
// Reply Form
// =========================
exports.replyForm = async (req, res) => {
    try {
        if (!req.session.userEmail) return res.redirect("/webmail/login");
        const email = await WebmailImap.getEmail(req.session, req.params.uid);
        const replyTo = email.from ? email.from.value[0].address : '';
        const replySubject = email.subject ? `Re: ${email.subject.replace(/^Re:\s*/i, '')}` : 'Re: (No Subject)';
        res.render("mail/compose", {
            title: 'Reply Email',
            from: req.query.from || 'inbox',
            prefill: { to: replyTo, subject: replySubject, body: '' }
        });
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
};

// =========================
// API: Send Email
// =========================
exports.send = async (req, res) => {
    try {
        const { to, subject, text, cc, bcc } = req.body;
        if (!to || !subject) {
            return res.status(400).json({ error: 'To and Subject are required' });
        }

        // Build session for SMTP - use logged-in user's email
        const smtpSession = {
            userEmail: req.session.userEmail,
            smtpHost: req.session.smtpHost,
            smtpPort: req.session.smtpPort || 25,
            smtpSecure: req.session.smtpSecure || false,
            smtpUser: req.session.userEmail,
            smtpPass: req.session.userPassword
        };

        const info = await sendMail(smtpSession, { to, subject, text, cc, bcc });
        res.json({ success: true, messageId: info.messageId });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
    }
};

// =========================
// API: Latest Email
// =========================
exports.latest = async (req, res) => {
    try {
        if (!req.session.userEmail) return res.status(401).json({ error: 'Not authenticated' });
        const emails = await WebmailImap.getInbox(req.session);
        if (!emails.length) return res.json(null);
        res.json(emails[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
