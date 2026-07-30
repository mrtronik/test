const FileManagerService = require('../services/FileManagerService');

exports.list = async (req, res) => {
    try {
        const dirPath = req.query.path || '/';
        const result = await FileManagerService.list(dirPath);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.readFile = async (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath) return res.status(400).json({ error: 'Path required' });
        const result = await FileManagerService.readFile(filePath);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.writeFile = async (req, res) => {
    try {
        const { path: filePath, content } = req.body;
        if (!filePath) return res.status(400).json({ error: 'Path required' });
        const result = await FileManagerService.writeFile(filePath, content || '');
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.createDir = async (req, res) => {
    try {
        const { path: dirPath } = req.body;
        if (!dirPath) return res.status(400).json({ error: 'Path required' });
        const result = await FileManagerService.createDir(dirPath);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.createFile = async (req, res) => {
    try {
        const { path: filePath } = req.body;
        if (!filePath) return res.status(400).json({ error: 'Path required' });
        const result = await FileManagerService.createFile(filePath);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.rename = async (req, res) => {
    try {
        const { oldPath, newPath } = req.body;
        if (!oldPath || !newPath) return res.status(400).json({ error: 'Both paths required' });
        const result = await FileManagerService.rename(oldPath, newPath);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const { path: targetPath } = req.body;
        if (!targetPath) return res.status(400).json({ error: 'Path required' });
        const result = await FileManagerService.delete(targetPath);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getInfo = async (req, res) => {
    try {
        const targetPath = req.query.path;
        if (!targetPath) return res.status(400).json({ error: 'Path required' });
        const result = await FileManagerService.getInfo(targetPath);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getPage = (req, res) => {
    res.render('pages/file-manager', { title: 'File Manager' });
};

exports.upload = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const dirPath = req.body.dir || '/';
        const result = await FileManagerService.upload(dirPath, req.file);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.extract = async (req, res) => {
    try {
        const { path: filePath } = req.body;
        if (!filePath) return res.status(400).json({ error: 'Path required' });
        const result = await FileManagerService.extract(filePath);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};
