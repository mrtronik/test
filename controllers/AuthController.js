const UserModel = require('../models/UserModel');
const bcrypt = require('bcrypt');

exports.loginForm = (req, res) => {
    res.render('login', {
    layout: 'layouts/auth'
});
};

exports.login = async (req, res) => {

    const { email, password } = req.body;

    try {
        const user = await UserModel.findByEmail(email);

        if (!user)
            return res.send("Email tidak ditemukan");

        console.log("Input Password :", password);
        console.log("Hash Database  :", user.password);

        const hash = user.password.replace('$2y$', '$2b$');

        const cocok = await bcrypt.compare(password, hash);

        console.log("Compare Result :", cocok);

        if (!cocok) {
            return res.send("Password salah");
        }

        req.session.user = user;

        res.redirect('/dashboard');

    } catch (err) {
        return res.send(err.message);
    }

};

exports.logout = (req, res) => {

    req.session.destroy(() => {
        res.redirect('/login');
    });

};
