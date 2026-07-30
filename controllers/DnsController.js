const DnsService = require('../services/DnsService');

exports.getPage = async (req, res) => {
    try {
        const domains = req.query.domain || '';
        const zones = DnsService.listZones();
        const bindActive = DnsService.checkBindStatus();
        let zoneData = null;

        if (domains) {
            zoneData = DnsService.getZoneRecords(domains);
        }

        res.render('dns/index', {
            title: 'DNS Manager',
            zones,
            bindActive,
            selectedDomain: domains,
            zoneData
        });
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    }
};

exports.getZoneRecords = async (req, res) => {
    try {
        const { domain } = req.query;
        if (!domain) return res.status(400).json({ error: 'Domain required' });
        const data = DnsService.getZoneRecords(domain);
        res.json({ success: true, ...data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createZone = async (req, res) => {
    try {
        const { domain, type } = req.body;
        if (!domain) return res.status(400).json({ error: 'Domain required' });
        const result = DnsService.createZone(domain, type);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteZone = async (req, res) => {
    try {
        const { domain } = req.body;
        if (!domain) return res.status(400).json({ error: 'Domain required' });
        const result = DnsService.deleteZone(domain);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.addRecord = async (req, res) => {
    try {
        const { domain, name, ttl, type, value } = req.body;
        if (!domain || !name || !type || !value) {
            return res.status(400).json({ error: 'All fields required' });
        }
        const result = DnsService.addRecord(domain, name, ttl, type, value);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteRecord = async (req, res) => {
    try {
        const { domain, name, type, value } = req.body;
        if (!domain || !name || !type || !value) {
            return res.status(400).json({ error: 'All fields required' });
        }
        const result = DnsService.deleteRecord(domain, name, type, value);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.importFromWebsite = async (req, res) => {
    try {
        const { domain, ip } = req.body;
        if (!domain) return res.status(400).json({ error: 'Domain required' });
        const result = DnsService.importFromWebsite(domain, ip);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
