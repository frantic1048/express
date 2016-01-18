
//导入after模块
var after = require('after');
//通过上级菜单的index.js导入lib/express
var express = require('..');
//导入supertest模块
var request = require('supertest');

//app测试模块
describe('app', function(){
  //mounted发生时应当发射mount事件
  it('should emit "mount" when mounted', function(done){
    //生成express对象blog,app
    var blog = express()
      , app = express();

    //对事件'mount'设定监听器，若触发'mount'事件，则运行function(parent)
    blog.on('mount', function(arg){
      //若触发事件的parent app为app，则测试通过
      arg.should.equal(app);
      done();
    });

    //将中间件blog挂载到'/'路径
    app.use(blog);
  })

  //use(app)测试模块
  describe('.use(app)', function(){
    //检测是否挂载app
    it('should mount the app', function(done){
      var blog = express()
        , app = express();

      //用get请求访问'/blog'时，立即结束，返回'blog'
      blog.get('/blog', function(req, res){
        res.end('blog');
      });

      app.use(blog);

      //get访问'app/blog'，若返回'blog'则测试通过
      request(app)
      .get('/blog')
      .expect('blog', done);
    })

    //检测是否支持挂载点
    it('should support mount-points', function(done){
      var blog = express()
        , forum = express()
        , app = express();

      //用get请求访问'/blog'时，立即结束，返回'blog'
      blog.get('/', function(req, res){
        res.end('blog');
      });

      //用get请求访问'/forum'时，立即结束，返回'forum'
      forum.get('/', function(req, res){
        res.end('forum');
      });

      app.use('/blog', blog);
      app.use('/forum', forum);

      //get访问'app/blog'，若返回'blog'则运行function
      request(app)
      .get('/blog')
      .expect('blog', function(){
        //get访问'app/forum'，若返回'forum'则测试通过
        request(app)
        .get('/forum')
        .expect('forum', done);
      });
    })

    //检测子app的parent是否正常
    it('should set the child\'s .parent', function(){
      var blog = express()
        , app = express();

      app.use('/blog', blog);
      //若blog的parent为app，则测试通过
      blog.parent.should.equal(app);
    })

    //检测是否支持动态路由
    it('should support dynamic routes', function(done){
      var blog = express()
        , app = express();

      //动态路由也需要访问'/blob'，返回'success'
      blog.get('/', function(req, res){
        res.end('success');
      });

      //动态路由，'/post'之后为article参数
      app.use('/post/:article', blog);

      //发送动态路由，'once-upon-a-time'为'article'
      request(app)
      .get('/post/once-upon-a-time')
      .expect('success', done);
    })

    //检测放在use的任何位置都可以触发mount事件
    it('should support mounted app anywhere', function(done){
      //执行三次都不出错即通过测试
      var cb = after(3, done);
      var blog = express()
        , other = express()
        , app = express();

      function fn1(req, res, next) {
        //设定'f-cn-1'参数，值为'hit'
        res.setHeader('x-fn-1', 'hit');
        next();
      }

      function fn2(req, res, next) {
        //设定'f-cn-2'参数，值为'hit'
        res.setHeader('x-fn-2', 'hit');
        next();
      }

      blog.get('/', function(req, res){
        res.end('success');
      });

      //对blog的事件'mount'设定一次性监听器，若触发'mount'事件，则运行function(parent)
      blog.once('mount', function (parent) {
        //检测到双亲app为'app'后，第二次执行cb
        parent.should.equal(app);
        cb();
      });
      //对other的事件'mount'设定一次性监听器，若触发'mount'事件，则运行function(parent)
      other.once('mount', function (parent) {
        //检测到双亲app为'app'后，第一次执行cb
        parent.should.equal(app);
        cb();
      });

      //触发other和blog的'mount'事件,通过两次cb()
      app.use('/post/:article', fn1, other, fn2, blog);

      //对与app动态的post请求
      //依次触发fn1(返回'x-fn-1', 'hit'),fn2(返回'x-fn-2', 'hit'),blog(返回'success')
      //若前述返回皆正确，第三次触发cb()，测试通过
      request(app)
      .get('/post/once-upon-a-time')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect('success', cb);
    })
  })

  //use(middleware)测试模块
  describe('.use(middleware)', function(){
    //检测是否支持use多个中间件
    it('should accept multiple arguments', function (done) {
      var app = express();

      function fn1(req, res, next) {
        res.setHeader('x-fn-1', 'hit');
        next();
      }

      function fn2(req, res, next) {
        res.setHeader('x-fn-2', 'hit');
        next();
      }

      //依次执行fn1,fn2,fn3
      app.use(fn1, fn2, function fn3(req, res) {
        res.setHeader('x-fn-3', 'hit');
        res.end();
      });

      //若按顺序返回fn1,fn2,fn3的set值且返回200状态码则通过用例
      request(app)
      .get('/')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect('x-fn-3', 'hit')
      .expect(200, done);
    })

    //检测是否任何请求都调用中间件
    it('should invoke middleware for all requests', function (done) {
      var app = express();
      var cb = after(3, done);

      app.use(function (req, res) {
        res.send('saw ' + req.method + ' ' + req.url);
      });

      //若对于get,options,post方法都返回对应值，即都通过了中间件，执行三次cb通过测试
      request(app)
      .get('/')
      .expect(200, 'saw GET /', cb);

      request(app)
      .options('/')
      .expect(200, 'saw OPTIONS /', cb);

      request(app)
      .post('/foo')
      .expect(200, 'saw POST /foo', cb);
    })

    //以数组的形式调用中间件
    it('should accept array of middleware', function (done) {
      var app = express();

      function fn1(req, res, next) {
        res.setHeader('x-fn-1', 'hit');
        next();
      }

      function fn2(req, res, next) {
        res.setHeader('x-fn-2', 'hit');
        next();
      }

      function fn3(req, res, next) {
        res.setHeader('x-fn-3', 'hit');
        res.end();
      }

      //以数组形式调用中间件fn1,fn2,fn3
      app.use([fn1, fn2, fn3]);

      //若按顺序返回fn1,fn2,fn3的set值且返回200状态码则通过用例
      request(app)
      .get('/')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect('x-fn-3', 'hit')
      .expect(200, done);
    })


    //以多个数组的形式调用中间件
    it('should accept multiple arrays of middleware', function (done) {
      var app = express();

      function fn1(req, res, next) {
        res.setHeader('x-fn-1', 'hit');
        next();
      }

      function fn2(req, res, next) {
        res.setHeader('x-fn-2', 'hit');
        next();
      }

      function fn3(req, res, next) {
        res.setHeader('x-fn-3', 'hit');
        res.end();
      }

      //以多个数组的形式调用中fn1,fn2和fn3
      app.use([fn1, fn2], [fn3]);

      //若按顺序返回fn1,fn2,fn3的set值且返回200状态码则通过用例
      request(app)
      .get('/')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect('x-fn-3', 'hit')
      .expect(200, done);
    })

    //以嵌套数组的形式调用中间件
    it('should accept nested arrays of middleware', function (done) {
      var app = express();

      function fn1(req, res, next) {
        res.setHeader('x-fn-1', 'hit');
        next();
      }

      function fn2(req, res, next) {
        res.setHeader('x-fn-2', 'hit');
        next();
      }

      function fn3(req, res, next) {
        res.setHeader('x-fn-3', 'hit');
        res.end();
      }

      //以嵌套数组的形式调用中fn1,fn2和fn3
      app.use([[fn1], fn2], [fn3]);

      //若按顺序返回fn1,fn2,fn3的set值且返回200状态码则通过用例
      request(app)
      .get('/')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect('x-fn-3', 'hit')
      .expect(200, done);
    })
  })

  //use(path,middleware)测试模块
  describe('.use(path, middleware)', function(){
    //检测是否拒绝丢失函数的请求
    it('should reject missing functions', function () {
      var app = express();
      //没有添加第三个参数，若throw出正确的错误则通用例
      app.use.bind(app, '/').should.throw(/requires middleware function/);
    })

    //检测是否拒绝参数不是函数的请求
    it('should reject non-functions as middleware', function () {
      var app = express();
      //分别以string,int,null,Date类作为函数参数传递
      //若都throw对应类型的错误即通过测试
      app.use.bind(app, '/', 'hi').should.throw(/requires middleware function.*string/);
      app.use.bind(app, '/', 5).should.throw(/requires middleware function.*number/);
      app.use.bind(app, '/', null).should.throw(/requires middleware function.*Null/);
      app.use.bind(app, '/', new Date()).should.throw(/requires middleware function.*Date/);
    })

    //检测req.url是否正常得到路径
    it('should strip path from req.url', function (done) {
      var app = express();

      app.use('/foo', function (req, res) {
        res.send('saw ' + req.method + ' ' + req.url);
      });

      //若req.url成功返回'/foo'路径后的/bar则通过用例
      request(app)
      .get('/foo/bar')
      .expect(200, 'saw GET /bar', done);
    })

    //检测可否接受多个中间件
    it('should accept multiple arguments', function (done) {
      var app = express();

      function fn1(req, res, next) {
        res.setHeader('x-fn-1', 'hit');
        next();
      }

      function fn2(req, res, next) {
        res.setHeader('x-fn-2', 'hit');
        next();
      }

      //在'foo'路径下引用fn1,fn2,fn3三个中间件
      app.use('/foo', fn1, fn2, function fn3(req, res) {
        res.setHeader('x-fn-3', 'hit');
        res.end();
      });

      //若访问'foo'路径可以正确得到fn1,fn2,fn3的返回值并得到状态码200，用例通过
      request(app)
      .get('/foo')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect('x-fn-3', 'hit')
      .expect(200, done);
    })

    //检测是否任何对应路径的请求都调用中间件
    it('should invoke middleware for all requests starting with path', function (done) {
      var app = express();
      var cb = after(3, done);

      app.use('/foo', function (req, res) {
        res.send('saw ' + req.method + ' ' + req.url);
      });

      //'app/'路径下完全没有使用，应该返回404状态码
      request(app)
      .get('/')
      .expect(404, cb);

      //'/foo','/foo/bar'应都能访问到函数
      //若req.url分别得到空值和'bar'，测试通过
      request(app)
      .post('/foo')
      .expect(200, 'saw POST /', cb);

      request(app)
      .post('/foo/bar')
      .expect(200, 'saw POST /bar', cb);
    })

    //若路径尾带'/'应该也可以使用
    it('should work if path has trailing slash', function (done) {
      var app = express();
      var cb = after(3, done);

      //使用带'/'的路径
      app.use('/foo/', function (req, res) {
        res.send('saw ' + req.method + ' ' + req.url);
      });

      //若通过同上的测试则用例通过
      request(app)
      .get('/')
      .expect(404, cb);

      request(app)
      .post('/foo')
      .expect(200, 'saw POST /', cb);

      request(app)
      .post('/foo/bar')
      .expect(200, 'saw POST /bar', cb);
    })

    //检测是否允许路径以数组的形式调用中间件
    it('should accept array of middleware', function (done) {
      var app = express();

      function fn1(req, res, next) {
        res.setHeader('x-fn-1', 'hit');
        next();
      }

      function fn2(req, res, next) {
        res.setHeader('x-fn-2', 'hit');
        next();
      }

      function fn3(req, res, next) {
        res.setHeader('x-fn-3', 'hit');
        res.end();
      }

      //在'foo'下以数组形式调用fn1,fn2,fn3
      app.use('/foo', [fn1, fn2, fn3]);

      //若按顺序返回fn1,fn2,fn3的set值且返回200状态码则通过用例
      request(app)
      .get('/foo')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect('x-fn-3', 'hit')
      .expect(200, done);
    })

    //检测是否允许路径以多个数组的形式调用中间件
    it('should accept multiple arrays of middleware', function (done) {
      var app = express();

      function fn1(req, res, next) {
        res.setHeader('x-fn-1', 'hit');
        next();
      }

      function fn2(req, res, next) {
        res.setHeader('x-fn-2', 'hit');
        next();
      }

      function fn3(req, res, next) {
        res.setHeader('x-fn-3', 'hit');
        res.end();
      }

      //在'foo'下以多个数组形式调用fn1,fn2,fn3
      app.use('/foo', [fn1, fn2], [fn3]);

      //若按顺序返回fn1,fn2,fn3的set值且返回200状态码则通过用例
      request(app)
      .get('/foo')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect('x-fn-3', 'hit')
      .expect(200, done);
    })

    //检测是否允许路径以嵌套数组的形式调用中间件
    it('should accept nested arrays of middleware', function (done) {
      var app = express();

      function fn1(req, res, next) {
        res.setHeader('x-fn-1', 'hit');
        next();
      }

      function fn2(req, res, next) {
        res.setHeader('x-fn-2', 'hit');
        next();
      }

      function fn3(req, res, next) {
        res.setHeader('x-fn-3', 'hit');
        res.end();
      }

      //在'foo'下以嵌套数组形式调用fn1,fn2,fn3
      app.use('/foo', [fn1, [fn2]], [fn3]);

      //若按顺序返回fn1,fn2,fn3的set值且返回200状态码则通过用例
      request(app)
      .get('/foo')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect('x-fn-3', 'hit')
      .expect(200, done);
    })

    //检测是否允许以数组的形式声明路径
    it('should support array of paths', function (done) {
      var app = express();
      var cb = after(3, done);

      //以数组的形式声明路径'/foo'和'/bar'
      app.use(['/foo/', '/bar'], function (req, res) {
        res.send('saw ' + req.method + ' ' + req.url + ' through ' + req.originalUrl);
      });

      //'app/'路径下完全没有使用，应该返回404状态码
      request(app)
      .get('/')
      .expect(404, cb);

      //'/foo','/foo/bar'应都能访问到函数
      //若req.url都得到空值，req.originalUrl分别得到'/foo'和'/bar'，测试通过
      request(app)
      .get('/foo')
      .expect(200, 'saw GET / through /foo', cb);

      request(app)
      .get('/bar')
      .expect(200, 'saw GET / through /bar', cb);
    })

    //检测是否允许以数组形式声明的路径以数组形式调用中间件
    it('should support array of paths with middleware array', function (done) {
      var app = express();
      var cb = after(2, done);

      function fn1(req, res, next) {
        res.setHeader('x-fn-1', 'hit');
        next();
      }

      function fn2(req, res, next) {
        res.setHeader('x-fn-2', 'hit');
        next();
      }

      function fn3(req, res, next) {
        res.setHeader('x-fn-3', 'hit');
        res.send('saw ' + req.method + ' ' + req.url + ' through ' + req.originalUrl);
      }

      //以数组形式声明的路径以数组形式调用fn1,fn2,fn3
      app.use(['/foo/', '/bar'], [[fn1], fn2], [fn3]);

      //若'/foo'和'/bar'路径都按顺序返回fn1,fn2,fn3的set值且返回200状态码则通过用例
      request(app)
      .get('/foo')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect('x-fn-3', 'hit')
      .expect(200, 'saw GET / through /foo', cb);

      request(app)
      .get('/bar')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect('x-fn-3', 'hit')
      .expect(200, 'saw GET / through /bar', cb);
    })

    //检测是否支持正则表达式定义的路径
    it('should support regexp path', function (done) {
      var app = express();
      var cb = after(4, done);

      //使用正则表达式定义以'/'开头，第二个字符为'a-z'，以oo/结尾的字符串为路径
      app.use(/^\/[a-z]oo/, function (req, res) {
        res.send('saw ' + req.method + ' ' + req.url + ' through ' + req.originalUrl);
      });

      //'app/'路径下完全没有使用，应该返回404状态码
      request(app)
      .get('/')
      .expect(404, cb);

      //'/foo'和'/zoo'满足正则表达式的条件，应都能访问到函数，返回200状态码
      request(app)
      .get('/foo')
      .expect(200, 'saw GET / through /foo', cb);

      request(app)
      .get('/zoo/bear')
      .expect(200, 'saw GET /bear through /zoo/bear', cb);

      //'/get'不满足正则表达式的条件，应不都能访问到函数
      request(app)
      .get('/get/zoo')
      .expect(404, cb);
    })

    //检测是否支持空路径
    it('should support empty string path', function (done) {
      var app = express();

      //定义空路径
      app.use('', function (req, res) {
        res.send('saw ' + req.method + ' ' + req.url + ' through ' + req.originalUrl);
      });

      //以空地址'/'访问，req.url和req.originalUrl应都为'/'
      request(app)
      .get('/')
      .expect(200, 'saw GET / through /', done);
    })
  })
})
