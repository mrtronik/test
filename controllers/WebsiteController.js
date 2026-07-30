const WebsiteService = require('../services/WebsiteService');

exports.index = async (req, res) => {
    try {
        const websites = await WebsiteService.listFromDB();
        res.render('websites/index', { title: 'Websites', websites });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.addForm = (req, res) => {
    res.render('websites/add', { title: 'Add Website' });
};

exports.create = async (req, res) => {
    try {
        let { domain, document_root, php_version } = req.body;

        domain = domain.toLowerCase().trim();

        const existing = await WebsiteService.findByDomain(domain);
        if (existing) {
            return res.render('websites/add', {
                title: 'Add Website',
                error: `Domain ${domain} already exists`
            });
        }

        if (!document_root) {
            document_root = `/home/public_html/${domain}`;
        }

        const id = await WebsiteService.save(domain, document_root, php_version);

        try {
            await WebsiteService.create(domain, document_root);
        } catch (olsErr) {
            console.error('OLS config error (non-fatal):', olsErr.message);
        }

        res.redirect('/websites');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.detail = async (req, res) => {
    try {
        const website = await WebsiteService.findById(req.params.id);
        if (!website) return res.redirect('/websites');
        res.render('websites/detail', { title: website.domain, website });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.suspend = async (req, res) => {
    try {
        await WebsiteService.updateStatus(req.params.id, 'suspended');
        res.redirect('/websites');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.activate = async (req, res) => {
    try {
        await WebsiteService.updateStatus(req.params.id, 'active');
        res.redirect('/websites');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.delete = async (req, res) => {
    try {
        const website = await WebsiteService.findById(req.params.id);
        if (website) {
            try {
                await WebsiteService.delete(website.domain);
            } catch (olsErr) {
                console.error('OLS delete error (non-fatal):', olsErr.message);
            }
        }
        await WebsiteService.remove(req.params.id);
        res.redirect('/websites');
    } catch (err) {
        res.status(500).send(err.message);
    }
};
