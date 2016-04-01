var mongoose = require('mongoose');
var Post = mongoose.model('Post');
var Comment = mongoose.model('Comment');
var passport = require('passport');
var express = require('express');
var router = express.Router();

// authentication middleware
var jwt = require('express-jwt');
var auth = jwt({secret: 'SECRET', userProperty: 'payload'});

var User = mongoose.model('User');



// defines a req.post middleware function
router.param('post', function (req, res, next, id) {
    // chained by Obj.find(query, selection, callback(error,result))
    // or: var query = Obj.find(query)
    //         query.select(fields)
    //         query.exec(handler(err, result) {if(err) return handleError(err)};
    //     
    var query = Post.findById(id);

    query.exec(function (err, post) {
        if (err) { return next(err); }
        if (!post) { return next(new Error('can\'t find post')); }

        // variable definition here
        req.post = post;
        return next();
    })
})

// defines a req.comment middleware function
router.param('comment', function (req, res, next, id) {
    var query = Comment.findById(id);

    query.exec(function (err, comment) {
        if (err) { return next(err); }
        if (!comment) { return next(new Error('can\'t find comment')); }

        req.comment = comment;
        return next();
    })
})

// GET all posts route url, and a function to handle the request
router.get('/posts', function (req, res, next) {

    // database find performed inside the GET request
    Post.find(function (err, posts) {
        if (err) { return next(err); }

        res.json(posts);
    })
})

// POST a new post
router.post('/posts', auth, function (req, res, next) {
    var post = new Post(req.body)
    post.author = req.payload.username;

    // save it self and return a json of what's saved
    post.save(function (err, post) {
        if (err) { return next(err); }

        res.json(post);
    })
})


// GET a specific post
router.get('/posts/:post', function (req, res, next) {

    // populate() joins the comments into the res.post
    req.post.populate('comments', function (err, post) {
        if(err) {return next(err);}
        res.json(post);
    })
});

// PUT an upvote to a post
router.put('/posts/:post/upvote', auth, function (req, res, next) {
    req.post.upvote(function (err, post) {
        if (err) { return next(err); }

        res.json(post);
    })
})

// PUT an upvote to a comment
router.put('posts/:post/comments/:comment/upvote', auth, function (req, res, next) {
    req.comment.upvote(function (err, post) {
        if (err) { return next(err); }

        res.json(comment);
    })
})

// POST a comment
router.post('/posts/:post/comments', auth, function (req, res, next) {
    var comment = new Comment(req.body);

    // req.post predefined by router.param()
    comment.post = req.post;

    // associate author with comment
    comment.author = req.payload.username;
    
    // save comment, inside call back saves to post
    comment.save(function (err, comment) {
        if (err) { return next(err); }

        // add comment to the req.post object and save post
        req.post.comments.push(comment);
        req.post.save(function (err, post) {
            if (err) { return next(err); }

            res.json(comment);
        });
    });
});

// POST a new user
router.post('/register', function (req, res, next) {
    if (!req.body.username || !req.body.password) {
        return res.status(400).json({ message: 'Please fill out all fields' });
    }

    var user = new User();

    user.username = req.body.username;

    user.setPassword(req.body.password)

    user.save(function (err) {
        if (err) { return next(err); }

        return res.json({ token: user.generateJWT() })
    });
});

// authentication
router.post('/login', function (req, res, next) {
    if (!req.body.username || !req.body.password) {
        return res.status(400).json({ message: 'Please fill out all fields' });
    }

    passport.authenticate('local', function (err, user, info) {
        if (err) { return next(err); }

        if (user) {
            return res.json({ token: user.generateJWT() });
        } else {
            return res.status(401).json(info);
        }
    })(req, res, next);
});



/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;



