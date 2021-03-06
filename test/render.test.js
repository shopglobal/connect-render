/*!
 * connect-render - test/render.test.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var path = require('path');
var rewire = require('rewire');
var fs = require('fs');
var connect = require('connect');
var request = require('supertest');
var render = rewire('../lib/render');
var should = require('should');

var options = {
  root: path.join(__dirname, 'views'),
  layout: 'layout.html',
  cache: true, // `false` for debug
  helpers: {
    sitename: 'connect-render demo site',
    starttime: new Date().getTime(),
    requestURL: function (req, res) {
      return req.url;
    },
    overwrite: 'default'
  },
  filters: {
    query: function (url) {
      return require('url').parse(url);
    }
  }
};

var app = connect(render(options));

app.use(function (req, res) {
  if (req.url === '/viewerror') {
    return res.render('noexists.html', { name: 'fengmk2' });
  }
  if (req.url === '/filters') {
    return res.render('filters.html', { layout: false });
  }
  if (req.url === '/xml') {
    res.setHeader('Content-Type', 'text/xml');
    return res.render('xml.html', { layout: false });
  }
  if (req.url === '/nolayout') {
    return res.render('nolayout.html', { layout: false });
  }
  if (req.url === '/partial_in_partial') {
    return res.render('./partial_in_partial.html', { layout: false });
  }
  if (req.url === '/partial_not_exists') {
    return res.render('partial_not_exists.html', { layout: false });
  }
  if (req.url === '/include') {
    return res.render('include.html', { layout: false, name: 'fengmk2', index: 'index' });
  }
  if (req.url === '/error') {
    return res.render('error.html');
  }
  if (req.url === '/options.scope') {
    return res.render('options.scope.html', { 
      layout: false, 
      scope: { name: 'scope test' },
      othername: 'out of scope name'
    });
  }
  if (req.url === '/layout_error') {
    return res.render('index.html', { 
      layout: 'error.html', 
      name: 'fengmk2'
    });
  }
  if (req.url === '/overwrite') {
    return res.render('overwrite.html', { 
      layout: false, 
      overwrite: 'success'
    });
  }
  if (req.url === '/nooverwrite') {
    return res.render('overwrite.html', { 
      layout: false
    });
  }

  res.render('index.html', { name: 'fengmk2' });
});

app.use(function (err, req, res, next) {
  // console.log(err.stack);
  next(err);
});

var success = fs.readFileSync(__dirname + '/success.html', 'utf8')
  .replace('$starttime$', options.helpers.starttime);


describe('render.test.js', function () {
  before(function (done) {
    app = app.listen(0, done);
  });

  describe('render()', function () {
    it('should work and return Content-Type', function (done) {
      var cache = render.__get__('cache');
      cache.should.not.have.property('index.html');
      cache.should.not.have.property('layout.html');
      request(app).get('/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, success)
      .end(function (err, res) {
        cache.should.have.property('index.html');
        // cache['index.html'].should.be.a('function');
        cache.should.have.property('layout.html');
        // cache['layout.html'].should.be.a('function');
        done(err);
      });
    });

    it('should return text/xml', function (done) {
      request(app)
      .get('/xml')
      .expect('Content-Type', 'text/xml; charset=utf-8')
      .expect(200, done);
    });

    it('should work with cache', function (done) {
      var cache = render.__get__('cache');
      cache.should.have.property('index.html');//.with.be.a('function');
      cache.should.have.property('layout.html');//.with.be.a('function');
      request(app).get('/')
      .expect(200)
      .expect(success)
      .end(function (err, res) {
        cache.should.have.property('index.html');//.with.be.a('function');
        cache.should.have.property('layout.html');//.with.be.a('function');
        done(err);
      });
    });

    it('should error when view not exists', function (done) {
      request(app).get('/viewerror')
      .expect(500)
      .expect(/ENOENT/, done);      
    });

    it('should return no layout', function (done) {
      request(app).get('/nolayout')
      .expect(200)
      .expect('nolayout', done);
    });

    it('should return 500 when template error', function (done) {
      request(app).get('/error')
      .expect(500, function (err, res) {
        should.not.exists(err);
        res.text.should.include('ReferenceError: ');
        res.text.should.include('error_var is not defined');
        done();
      });
    });

    it('should return 500 when layout error', function (done) {
      request(app).get('/layout_error')
      .expect(500)
      .expect(/error_var is not defined/, done);
    });

    // options.scope not support on ejs@0.8.4+
    // https://github.com/visionmedia/ejs/commit/5786c8e5af92f4a52a214850b6b1220682ed9d79
    it.skip('should support options.scope', function (done) {
      request(app).get('/options.scope')
      .expect(200, function (err, res) {
        should.not.exists(err);
        res.text.should.equal('scope test:out of scope name');
        done();
      });
    });

    it('should render with filters', function (done) {
      request(app).get('/filters')
      .expect(200)
      .expect('你… | /filters\n', done);
    });

    it('should overwrite:`default` to overwrite:`success`', function (done) {
      request(app).get('/overwrite')
      .expect(200)
      .expect('success', done);
    });

    it('should overwrite:`default` to overwrite:`default`', function (done) {
      request(app).get('/nooverwrite')
      .expect(200)
      .expect('default', done);
    });
  });

  describe('partial()', function () {
    it('should fixed partial in partial', function (done) {
      request(app).get('/partial_in_partial')
      .expect(200)
      .expect('partialpartial', done);
    });

    it('should console.error when partial view not exists', function (done) {
      var _error = console.error;
      var errormsg = '';
      console.error = function (msg) {
        var util = require('util');
        errormsg = util.format.apply(util, Array.prototype.slice.call(arguments));
      };
      request(app).get('/partial_not_exists')
      .expect(200)
      .expect('partial_not_exists')
      .end(function (err, res) {
        console.error = _error;
        errormsg.should.include('[connect-render] Error: cannot load view partial');
        errormsg.should.include('Error: ENOENT, no such file or directory');
        done(err);
      });
    });
  });

  describe('include with ejs', function () {
    it('should support include', function (done) {
      request(app).get('/include')
      .expect(200)
      .expect('Hi, I will include "be_included".\nI should be included\n\n', done);
    });
  });
});
