const express = require("express"); // web server framework we're using
const app = express();
const bodyParser = require("body-parser"); // to parse info from a post request
const mongoose = require("mongoose");
const passport = require("passport");   // authentication middleware for node.js with different strategies (login, fb, twitter, etc.)
const LocalStrategy = require("passport-local"); // local strategy = username and passpord
const Beer = require("./models/beer");
const User = require("./models/user");
const Comment = require("./models/comment");

//var seedDB = require("./seeds");

//seedDB();

// Mongoose settings
mongoose.set('useUnifiedTopology', true);
mongoose.connect("mongodb://localhost/beer_diary", { useNewUrlParser: true });

app.use(bodyParser.json()); // parse JSON request body to be able to call res.json
app.use(bodyParser.urlencoded({extended: true})); // parsing bodies from url (key-val pairs)
app.set("view engine", "ejs");

// Passport Configuration
app.use(require("express-session")({    // need to include seperate package for session and express
    // !!! in production => produce a randomly generated string from environment var
    secret: "HoldMyBeer",   // used to sign the session ID cookie (salt for the hash/ encode and decode the sessions)
    // forces the session to be saved back to the session store (even if it was never modified during request)
    resave: false,
    // saveUnitialized - forces a session that is unitialized (new but not modified) to be saved to the store
    saveUninitialized: false // false - reduces server storage usage and comply with laws that require permission before setting a cookie
}));

app.use(passport.initialize()); // middleware that's required to initialize Passport
app.use(passport.session()); // session - provide state to http requests (sending along user info with request)
passport.use(new LocalStrategy(User.authenticate())); // using locaal strategy

// tell passport to use what's already defined on the user (methods we got from plugging in passportLocalMongoose)
passport.serializeUser(User.serializeUser()); // setting id as cookie in user's browser (encoding)
passport.deserializeUser(User.deserializeUser()); // getting id from cookie => used in callback to get user info (decoding)

// whatever function we pass in app.use will be called in every route
app.use(function(req, res, next) {
    // want every route to have access to req.user
    res.locals.currentUser = req.user;
    next();
});

app.get("/", function(req, res) {
    res.redirect("/beers"); 
});

// Index route - show all beers
app.get("/beers", function(req, res) {
    Beer.find({}, function(err, allBeers) {
        if (err) {
            console.log(err);
        } else {
            res.render("beers/beers", {beers: allBeers, currentUser: req.user});
        }
    })
});

// AUTH Routes
// show register form
app.get("/register", function(req, res) {
    res.render("register");
});
// handle sign up logic
app.post("/register", function(req, res) {
    var newUser = new User({username: req.body.username});
    // User.register will make a new user and handle the logic of hashing the password
    User.register(newUser, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            return res.render("register");
        }
        // once user is signed up, will log them in (authenticate)
        passport.authenticate("local")(req, res, function() {
            res.redirect("/beers");
        });
    }) 
});

// show login form
app.get("/login", function(req, res) {
    res.render("login");
});

// after logging in, passport will put the username and id in req.user
// calling passport.authenticate => will use the method from the passport-local-mongoose package on User obj
app.post("/login", passport.authenticate("local", {
    successRedirect: "/beers",
    failureRedirect: "/login",
    //failureFlash: true
}));

// logout
app.get("/logout", function(req, res) {
    req.logout();
    res.redirect("/beers");
});

// middleware
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }

    res.redirect("/login");
}

// call middleware first and then continue to callback if logged in
// New route - show form to create a new beer
app.get("/beers/new", isLoggedIn, function(req, res) {
    res.render("beers/new");
});

// Create route - adding a new beer
app.post("/beers", function(req, res) {
    // get data from form and add to array
    var name = req.body.name;
    var image = req.body.image;
    var desc = req.body.description;
    var newBeer = {name: name, image: image, desc: desc};
    // Create a new beer and save to DB
    Beer.create(newBeer, function(err, newBeer) {
        if (err) {
            console.log(err);
        } else {
            res.redirect("/beers");
        }
    });
});

// viewing beer details - make sure to put after new route 
// * new is technically after /beers/
app.get("/beers/:id", function(req, res) {
    // find campground with the id and populate with comments obj connected to this beer obj
    Beer.findById(req.params.id).populate("comments").exec(function(err, foundBeer) {
        if (err) {
            console.log(err);
        } else {
            res.render("beers/show", {beer: foundBeer});
        }
    });
});

//==== COMMENTS ROUTES ======
app.post("/beers/:id/comments", isLoggedIn, function(req, res) {
    // look up beer using id
    Beer.findById(req.params.id, function(err, foundBeer) {
        if (err) {
            console.log(err);
            return res.redirect("/beers");
        } 

        // create new comment
        var comment = req.body.comment;
        Comment.create(comment, function(err, newComment) {
            if (err) {
                console.log(err);
                return res.redirect("/beers");
            } 

            // connect new comment to beer
            foundBeer.comments.push(newComment);
            foundBeer.save();
            res.redirect("/beers/" + foundBeer._id);
        });
    });
});

app.listen(3000, function() {
    console.log("Server started!");
});