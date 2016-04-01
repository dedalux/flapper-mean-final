var mongoose = require('mongoose');

var PostSchema = new mongoose.Schema({
    title: String,
    link: String,
    author: String,
    upvotes: { type: Number, default: 0 },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }]
});

// upvote method for post
PostSchema.methods.upvote = function (cb) {
    this.upvotes++;
    this.save(cb);
};

mongoose.model('Post', PostSchema);