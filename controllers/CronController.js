const CronService = require('../services/CronService');

exports.getPage = async (req, res) => {
    try {
        const jobs = CronService.listJobs();
        const systemJobs = CronService.listSystemCrons();
        res.render('cron/index', { title: 'Cron Job Manager', jobs, systemJobs });
    } catch (err) {
        res.render('cron/index', { title: 'Cron Job Manager', jobs: [], systemJobs: [] });
    }
};

exports.listJobs = async (req, res) => {
    try {
        const jobs = CronService.listJobs();
        res.json({ success: true, jobs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.addJob = async (req, res) => {
    try {
        const { schedule, command } = req.body;
        if (!schedule || !command) return res.status(400).json({ error: 'Schedule and command are required' });

        CronService.addJob(schedule, command);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateJob = async (req, res) => {
    try {
        const { index, schedule, command } = req.body;
        if (index === undefined || !schedule || !command) return res.status(400).json({ error: 'All fields required' });

        CronService.updateJob(parseInt(index), schedule, command);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteJob = async (req, res) => {
    try {
        const { index } = req.body;
        if (index === undefined) return res.status(400).json({ error: 'Index required' });

        CronService.deleteJob(parseInt(index));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
