const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

class WebmailImap {

    static _getClient(session) {
        return new ImapFlow({
            host: session.imapHost || 'localhost',
            port: parseInt(session.imapPort) || 993,
            secure: session.imapSecure !== false,
            auth: {
                user: session.userEmail,
                pass: session.userPassword
            },
            timeout: 10000,
            tls: {
                rejectUnauthorized: false
            },
            logger: false
        });
    }

    static async _withLock(session, fn) {
        let client;
        let lock;
        try {
            client = this._getClient(session);
            await client.connect();
            lock = await client.getMailboxLock("INBOX");
            return await fn(client, lock);
        } catch (err) {
            throw err;
        } finally {
            if (lock) lock.release();
            if (client) {
                try { await client.logout(); } catch {}
            }
        }
    }

    static async testConnection(session) {
        let client;
        try {
            client = this._getClient(session);
            await client.connect();
            await client.logout();
            return { success: true };
        } catch (err) {
            if (client) {
                try { await client.logout(); } catch {}
            }
            return { success: false, error: err.message };
        }
    }

    static async getInbox(session) {
        return await this._withLock(session, async (client) => {
            const emails = [];
            const exists = client.mailbox ? client.mailbox.exists : 0;
            if (exists === 0) return emails;

            for await (const msg of client.fetch("1:*", {
                uid: true,
                envelope: true,
                flags: true
            })) {
                emails.push({
                    uid: msg.uid,
                    from: msg.envelope.from && msg.envelope.from.length
                        ? msg.envelope.from[0].address : "",
                    name: msg.envelope.from && msg.envelope.from.length
                        ? msg.envelope.from[0].name : "",
                    subject: msg.envelope.subject || "(No Subject)",
                    date: msg.envelope.date,
                    seen: msg.flags && msg.flags.has("\\Seen")
                });
            }
            return emails.reverse();
        });
    }

    static async getEmail(session, uid) {
        return await this._withLock(session, async (client) => {
            const msg = await client.fetchOne(uid, {
                source: true,
                uid: true,
                envelope: true,
                flags: true
            }, { uid: true });
            if (!msg) throw new Error("Email not found");
            const parsed = await simpleParser(msg.source);
            parsed.uid = uid;
            parsed.seen = msg.flags && msg.flags.has("\\Seen");
            return parsed;
        });
    }

    static async markSeen(session, uid) {
        return await this._withLock(session, async (client) => {
            await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
        });
    }

    static async markUnseen(session, uid) {
        return await this._withLock(session, async (client) => {
            await client.messageFlagsDelete(uid, ["\\Seen"], { uid: true });
        });
    }

    static async deleteEmail(session, uid) {
        return await this._withLock(session, async (client) => {
            await client.messageFlagsAdd(uid, ["\\Deleted"], { uid: true });
            await client.expunge();
        });
    }
}

module.exports = WebmailImap;
