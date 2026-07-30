 
exports.about = (req, res) => {
     res.render('about', {
        title: 'PLC Lokal Indonesia',
         
    });

};
exports.index = (req, res) => {

    res.render('home', {
        title: 'PLC Lokal Indonesia',
         
    });

};