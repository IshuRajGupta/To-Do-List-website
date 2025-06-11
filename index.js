const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/todo-auth', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Connection Error:", err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    age: Number,
    gender: String,
    profileImage: String
});
const User = mongoose.model('User', userSchema);

// Middleware
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

const upload = multer({ dest: 'public/uploads/' });

function checkAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Routes
app.get('/', checkAuth, async (req, res) => {
    fs.readdir(`./files`, async (err, files) => {
        const userData = await User.findOne({ username: req.session.user });
        res.render("index", { files: files, user: userData });
    });
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', upload.single('profileImage'), async (req, res) => {
    const { username, password, age, gender } = req.body;
    const existingUser = await User.findOne({ username });

    if (existingUser) return res.send("Username already exists");

    const passwordHash = await bcrypt.hash(password, 10);
    const profileImage = req.file ? req.file.filename : null;

    const user = new User({ username, passwordHash, age, gender, profileImage });
    await user.save();
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (user && await bcrypt.compare(password, user.passwordHash)) {
        req.session.user = user.username;
        res.redirect('/');
    } else {
        res.send("Invalid username or password");
    }
});

app.post('/update-profile-pic', upload.single('newProfileImage'), async (req, res) => {
    if (!req.session.user || !req.file) return res.redirect('/');

    await User.updateOne(
        { username: req.session.user },
        { profileImage: req.file.filename }
    );

    res.redirect('/');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// To-Do Routes
app.post('/create', checkAuth, (req, res) => {
    fs.writeFile(`./files/${req.body.title.split(' ').join('')}.txt`, req.body.content, err => {
        res.redirect('/');
    });
});

app.get('/read/:title', checkAuth, (req, res) => {
    fs.readFile(`./files/${req.params.title}`, 'utf-8', (err, filedata) => {
        res.render('task', { filename: req.params.title, filedata: filedata });
    });
});

app.get('/delete/:title', checkAuth, (req, res) => {
    fs.unlink(`./files/${req.params.title}`, err => {
        res.redirect('/');
    });
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));