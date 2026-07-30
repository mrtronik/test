require('dotenv').config();
const express = require('express');
const app = express();
const session = require('express-session');
const web = require('./routes/web');
const api = require('./routes/api'); 
const expressLayouts = require('express-ejs-layouts');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const sessionConfig = require('./config/session');

app.use(session({
    store: sessionConfig.store,
    secret: process.env.APP_KEY,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: sessionConfig.secure,
        maxAge: sessionConfig.lifetime * 60 * 1000
    }
}));


app.use(expressLayouts);
app.set('layout', 'layouts/app');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/', web);
app.use('/api', api);

 
const http = require("http");

const server = http.createServer(app);

const { Server } = require("socket.io");

const io = new Server(server);
const socket = require("./socket");

socket.setIO(io);

const { initTerminalSocket } = require("./terminalSocket");
initTerminalSocket(io);

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err.message);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err.message);
});

server.listen(3000, () => {
    console.log("Server jalan...");
});