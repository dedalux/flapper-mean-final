/// <reference path="angular.min.js" />

var app = angular.module('flapperNews', ['ui.router']); // ui DOT router--

app.config([
    '$stateProvider',
    '$urlRouterProvider',
    function ($stateProvider, $urlRouterProvider) {
        $stateProvider
            .state('home', {
                url: '/home',
                templateUrl: '/home.html',
                controller: 'MainCtrl',

                // call getAll() at appropriate time with resolve property
                // query all posts from backend before state finishes loading
                resolve: {
                    postPromise: ['posts', function(posts){
                        return posts.getAll();
                    }]
                }
            })

            .state('posts', {
                url: '/posts/{id}', // watch for URL forward slashes
                templateUrl: '/posts.html',
                controller: 'PostsCtrl',

                resolve: {
                    post: ['$stateParams', 'posts', function ($stateParams, posts) {
                        return posts.get($stateParams.id);
                    }]
                }
            })

            .state('login', {
                url: '/login',
                templateUrl: '/login.html',
                controller: 'AuthCtrl',
                onEnter: ['$state', 'auth', function($state, auth){
                    if(auth.isLoggedIn()){
                        $state.go('home');
                    }
                }]
            })

            .state('register', {
                url: '/register',
                templateUrl: '/register.html',
                controller: 'AuthCtrl',
                onEnter: ['$state', 'auth', function($state, auth){
                    if(auth.isLoggedIn()){
                        $state.go('home');
                    }
                }]
            });

        $urlRouterProvider.otherwise('home'); //return to home if bad URL is specified
    }
]);


// Middle ground between angular front and node backend
// Factory passes all methods/prop to posts Obj
app.factory('posts', ['$http', 'auth', function ($http, auth) {
    
    var o = {
        posts: []
    };

    // get all posts from index route
    o.getAll = function() {
        return $http.get('/posts').success(function (data) {
            
            // this method updates MainCtrl and $scope.posts
            angular.copy(data, o.posts)
        });
    }

    // create a new post
    o.create = function (post) {
        return $http.post('/posts', post, {
            headers: { Authorization: 'Bearer ' + auth.getToken() }
        }).success(function (data) {
            o.posts.push(data);
        });
    };

    // upvote a post
    o.upvote = function (post) {
        return $http.put('/posts/' + post._id + '/upvote', null, {
            headers: { Authorization: 'Bearer ' + auth.getToken() }
        }).success(function (data) {
            post.upvotes += 1;
        });
    };

    // get all comments associated with post (post.comments populated in node)
    o.get = function (id) {
        return $http.get('/posts/' + id).then(function (res) { // using then() promise
            return res.data
        })
    }

    o.addComment = function (id, comment) {
        return $http.post('/posts/' + id + '/comments', comment, {
            headers: { Authorization: 'Bearer ' + auth.getToken() }
        });
    };


    return o;

    o.upvoteComment = function (post, comment) {
        return $http.put('/posts/' + post._id + '/comments/' + comment._id + '/upvote', null, {
            headers: { Authorization: 'Bearer ' + auth.getToken() }
        }).success(function (data) {
            comment.upvotes += 1;
        });
    };

}]);

app.factory('auth', ['$http', '$window', function ($http, $window) {
    var auth = {}
    
    auth.saveToken = function (token) {
        $window.localStorage['flapper-news-token'] = token;
    };

    // retrieve token
    auth.getToken = function () {
        return $window.localStorage['flapper-news-token'];
    };

    // check logged in status, whether it's expired
    auth.isLoggedIn = function () {
        var token = auth.getToken();

        if (token) {
            // payload is middle part of token between 2 '.'
            // convert from base64 using $window.atob
            // back to js with JSON.parse 
            var payload = JSON.parse($window.atob(token.split('.')[1]));

            return payload.exp > Date.now() / 1000;
        } else {
            return false;
        }
    };

    // get current username
    auth.currentUser = function () {
        if (auth.isLoggedIn()) {
            var token = auth.getToken();
            var payload = JSON.parse($window.atob(token.split('.')[1]));

            return payload.username;
        }
    }

    // registration 
    auth.register = function (user) {
        // post a user to register
        return $http.post('/register', user).success(function (data) {
            // save a token if successful
            auth.saveToken(data.token);
        })
    }

    // log user in and give a token
    auth.logIn = function (user) {
        return $http.post('/login', user).success(function (data) {
            auth.saveToken(data.token);
        });
    };

    // log out by simply removing token
    auth.logOut = function () {
        $window.localStorage.removeItem('flapper-news-token');
    };

    return auth;
}])


app.controller('MainCtrl', ['$scope', 'posts', 'auth',
    function ($scope, posts, auth) {
        $scope.posts = posts.posts;
        $scope.isLoggedIn = auth.isLoggedIn;

    $scope.addPost = function () {
        if (!$scope.title || $scope.title === "") { return; }

        // $scope.posts.push({ -- old for non-persistent page

        posts.create({
            title: $scope.title,
            link: $scope.link,
            author: auth.currentUser
        });
        $scope.title = "";
        $scope.link = "";
    };

    $scope.incrementUpvotes = function (post) {
        // post.upvotes++;
        posts.upvote(post);
    };
    
    $scope.posts = posts.posts;
}]);



app.controller('PostsCtrl', [
    '$scope',
    // '$stateParams', no need to inject after resolve
    'posts',
    'post',
    'auth',
    function ($scope, posts, post, auth) {
        
        // $scope.post = posts.posts[$stateParams.id];
        // get it directly after injection
        $scope.isLoggedIn = auth.isLoggedIn;
        $scope.post = post;

        $scope.addComment = function () {
            if ($scope.body === '') { return; }

            
            // $scope.post.comments.push({
            posts.addComment(post._id, {
                body: $scope.body,
                author: auth.currentUser,
            }).success(function (comment) {
                // post success client side effect
                $scope.post.comments.push(comment);
            });

            $scope.body = '';
        };

        $scope.incrementUpvotes = function (comment) {
            posts.upvoteComment(post, comment);
        };
    }
]);


// authentication
app.controller('AuthCtrl', [
'$scope',
'$state',
'auth',
function ($scope, $state, auth) {
    $scope.user = {};

    $scope.register = function () {
        auth.register($scope.user).error(function (error) {
            $scope.error = error;
        }).then(function () {
            $state.go('home');
        });
    };

    $scope.logIn = function () {
        auth.logIn($scope.user).error(function (error) {
            $scope.error = error;
        }).then(function () {
            $state.go('home');
        });
    };
}]);

app.controller('NavCtrl', [
'$scope',
'auth',
function ($scope, auth) {
    $scope.isLoggedIn = auth.isLoggedIn;
    $scope.currentUser = auth.currentUser;
    $scope.logOut = auth.logOut;
}]);




