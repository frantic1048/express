
//导入after模块
var after = require('after');
//通过上级菜单的index.js导入lib/express
//创建一个新router命名为Router
//导入方法和断言模块
var express = require('../')
  , Router = express.Router
  , methods = require('methods')
  , assert = require('assert');

//路由器
describe('Router', function(){
  //检测router的函数是否都返回函数
  it('should return a function with router methods', function() {
    //router本身为function类型
    var router = Router();
    assert(typeof router == 'function');

    var router = new Router();
    assert(typeof router == 'function');
    //router下的get,handle,use返回值应都为function
    assert(typeof router.get == 'function');
    assert(typeof router.handle == 'function');
    assert(typeof router.use == 'function');
  });

  //检测路由器是否可以挂载别的路由器
  it('should support .use of other routers', function(done){
    var router = new Router();
    var another = new Router();

    another.get('/bar', function(req, res){
      res.end();
    });
    //挂载另一个路由器作为中间件
    router.use('/foo', another);

    //若成功访问router挂载的another路由器，则用例通过
    router.handle({ url: '/foo/bar', method: 'GET' }, { end: done });
  });

  //检测是否支持动态路由
  it('should support dynamic routes', function(done){
    var router = new Router();
    var another = new Router();

    //给another'/'路径下挂载动态路由，定义参数bar
    another.get('/:bar', function(req, res){
      //参数bar应等于'route'
      req.params.bar.should.equal('route');
      res.end();
    });
    //给router'/'路径下挂载动态路由
    router.use('/:foo', another);

    //若成功访问router挂载的another路由器，则用例通过，令another下动态参数为'route'
    router.handle({ url: '/test/route', method: 'GET' }, { end: done });
  });

  //检测是否处理空地址
  it('should handle blank URL', function(done){
    var router = new Router();

    router.use(function (req, res) {
      false.should.be.true;
    });

    //以空地址访问，成功则通过用例
    router.handle({ url: '', method: 'GET' }, {}, done);
  });

  //检测是否因为注册过多路径而栈溢出
  it('should not stack overflow with many registered routes', function(done){
    //6000个诱导路径任一个被访问即报错
    var handler = function(req, res){ res.end(new Error('wrong handler')) };
    var router = new Router();

    //router下注册6001个路径，添加报错函数
    for (var i = 0; i < 6000; i++) {
      router.get('/thing' + i, handler)
    }

    router.get('/', function (req, res) {
      res.end();
    });

    //若访问没有出错，则没有栈溢出，用例通过
    router.handle({ url: '/', method: 'GET' }, { end: done });
  });

  //handle检测模块
  describe('.handle', function(){
    //检测是否能分派路径
    it('should dispatch', function(done){
      var router = new Router();

      //为'/foo'路径绑定get相应事件
      router.route('/foo').get(function(req, res){
        res.send('foo');
      });

      //给res的send返回值设定检测函数
      //若返回'foo'则用例通过
      var res = {
        send: function(val) {
          val.should.equal('foo');
          done();
        }
      }
      router.handle({ url: '/foo', method: 'GET' }, res);
    })
  })

  //多个回调检测模块
  describe('.multiple callbacks', function(){
    //检测回调为空是否报错
    it('should throw if a callback is null', function(){
      assert.throws(function () {
        var router = new Router();
        //回调置空
        router.route('/foo').all(null);
      })
    })

    //检测回调未定义是否报错
    it('should throw if a callback is undefined', function(){
      assert.throws(function () {
        var router = new Router();
        //回调写未定义函数
        router.route('/foo').all(undefined);
      })
    })

    //检测回调不是函数是否报错
    it('should throw if a callback is not a function', function(){
      assert.throws(function () {
        var router = new Router();
        //回调设置为字符串
        router.route('/foo').all('not a function');
      })
    })

    //检测回调都是函数是否不报错
    it('should not throw if all callbacks are functions', function(){
      var router = new Router();
      //回调设置为空函数
      router.route('/foo').all(function(){}).all(function(){});
    })
  })

  //错误检测模块
  describe('error', function(){
    //检测报错时是否跳过没有设置错误参数的函数
    it('should skip non error middleware', function(done){
      var router = new Router();

      //正常访问至此，应该报错'foo'
      router.get('/foo', function(req, res, next){
        next(new Error('foo'));
      });

      router.get('/bar', function(req, res, next){
        next(new Error('bar'));
      });

      //未设置错误参数，报错时应该被跳过
      router.use(function(req, res, next){
        assert(false);
      });

      //设置设置错误参数，报错时应该执行
      router.use(function(err, req, res, next){
        assert.equal(err.message, 'foo');
        done();
      });

      router.handle({ url: '/foo', method: 'GET' }, {}, done);
    });

    //检测是否抛出有参数的路径的错误
    it('should handle throwing inside routes with params', function(done) {
      var router = new Router();

      //若以带参数的路径访问'foo'则抛出错误
      router.get('/foo/:id', function(req, res, next){
        throw new Error('foo');
      });

      //诱导路径，直接报错
      router.use(function(req, res, next){
        assert(false);
      });

      //若报错应执行此中间件,正常执行则通过用例
      router.use(function(err, req, res, next){
        assert.equal(err.message, 'foo');
        done();
      });

      router.handle({ url: '/foo/2', method: 'GET' }, {}, function() {});
    });

    //检测是否抛出动态路径的错误
    it('should handle throwing in handler after async param', function(done) {
      var router = new Router();

      //若检测到添加参数'user'则触发
      router.param('user', function(req, res, next, val){
        process.nextTick(function(){
          req.user = val;
          next();
        });
      });

      //若检测到'user'参数，则抛出错误
      router.use('/:user', function(req, res, next){
        throw new Error('oh no!');
      });

      //若检测到抛出错误，检测抛出错误信息正确通过用例
      router.use(function(err, req, res, next){
        assert.equal(err.message, 'oh no!');
        done();
      });

      router.handle({ url: '/bob', method: 'GET' }, {}, function() {});
    });

    //检测能否处理内部抛出错误的错误
    it('should handle throwing inside error handlers', function(done) {
      var router = new Router();

      //正常抛出错误
      router.use(function(req, res, next){
        throw new Error('boom!');
      });

      //检测抛出错误，抛出新错误
      router.use(function(err, req, res, next){
        throw new Error('oops');
      });

      //若检测到新抛出的错误，用例通过
      router.use(function(err, req, res, next){
        assert.equal(err.message, 'oops');
        done();
      });

      router.handle({ url: '/', method: 'GET' }, {}, done);
    });
  })

  //正式域名测试模块
  describe('FQDN', function () {
    //不应该模糊正式域名
    it('should not obscure FQDNs', function (done) {
      var request = { hit: 0, url: 'http://example.com/foo', method: 'GET' };
      var router = new Router();

      //应该先触发此处中间件,hit先+1
      //正式域名应完整保存
      router.use(function (req, res, next) {
        assert.equal(req.hit++, 0);
        assert.equal(req.url, 'http://example.com/foo');
        next();
      });

      //由于先触发中间件,此处hit应该为1，用例通过
      router.handle(request, {}, function (err) {
        if (err) return done(err);
        assert.equal(request.hit, 1);
        done();
      });
    });

    //应该忽视正式域名中寻找路径的部分
    it('should ignore FQDN in search', function (done) {
      var request = { hit: 0, url: '/proxy?url=http://example.com/blog/post/1', method: 'GET' };
      var router = new Router();

      //'proxy'用来匹配路径，检测url的时候应该将其忽视
      router.use('/proxy', function (req, res, next) {
        assert.equal(req.hit++, 0);
        assert.equal(req.url, '/?url=http://example.com/blog/post/1');
        next();
      });

      //按顺序访问中间件和handle则通过用例
      router.handle(request, {}, function (err) {
        if (err) return done(err);
        assert.equal(request.hit, 1);
        done();
      });
    });

    //检测是否忽视了正式域名中的路径
    it('should ignore FQDN in path', function (done) {
      var request = { hit: 0, url: '/proxy/http://example.com/blog/post/1', method: 'GET' };
      var router = new Router();

      //若忽视了路径'/proxy'则通过用例
      router.use('/proxy', function (req, res, next) {
        assert.equal(req.hit++, 0);
        assert.equal(req.url, '/http://example.com/blog/post/1');
        next();
      });

      router.handle(request, {}, function (err) {
        if (err) return done(err);
        assert.equal(request.hit, 1);
        done();
      });
    });

    //应该检测根据访问的路径调整正式域名
    it('should adjust FQDN req.url', function (done) {
      var request = { hit: 0, url: 'http://example.com/blog/post/1', method: 'GET' };
      var router = new Router();

      //已经访问'/blog'，应该在正式域名中减去对应部分
      router.use('/blog', function (req, res, next) {
        assert.equal(req.hit++, 0);
        assert.equal(req.url, 'http://example.com/post/1');
        next();
      });

      router.handle(request, {}, function (err) {
        if (err) return done(err);
        assert.equal(request.hit, 1);
        done();
      });
    });

    //检测是否根据中间件不同调整成不同的正式域名
    it('should adjust FQDN req.url with multiple handlers', function (done) {
      var request = { hit: 0, url: 'http://example.com/blog/post/1', method: 'GET' };
      var router = new Router();

      //对应空路径，url应该不变
      router.use(function (req, res, next) {
        assert.equal(req.hit++, 0);
        assert.equal(req.url, 'http://example.com/blog/post/1');
        next();
      });

      //对应'/blog'路径，url应该减去对应值
      router.use('/blog', function (req, res, next) {
        assert.equal(req.hit++, 1);
        assert.equal(req.url, 'http://example.com/post/1');
        next();
      });

      router.handle(request, {}, function (err) {
        if (err) return done(err);
        assert.equal(request.hit, 2);
        done();
      });
    });

    //检测是否根据中间件不同调整成不同的已被路由的正式域名
    it('should adjust FQDN req.url with multiple routed handlers', function (done) {
      var request = { hit: 0, url: 'http://example.com/blog/post/1', method: 'GET' };
      var router = new Router();

      //应该同时启用'/blog'对应的中间件,所以两个中间件的参数应该相同
      router.use('/blog', function (req, res, next) {
        assert.equal(req.hit++, 0);
        assert.equal(req.url, 'http://example.com/post/1');
        next();
      });

      router.use('/blog', function (req, res, next) {
        assert.equal(req.hit++, 1);
        assert.equal(req.url, 'http://example.com/post/1');
        next();
      });

      //没有对应路径的中间件
      router.use(function (req, res, next) {
        assert.equal(req.hit++, 2);
        assert.equal(req.url, 'http://example.com/blog/post/1');
        next();
      });

      router.handle(request, {}, function (err) {
        if (err) return done(err);
        assert.equal(request.hit, 3);
        done();
      });
    });
  })

  //.all检测模块
  describe('.all', function() {
    //检测是否支持用.all捕获所有http请求
    it('should support using .all to capture all http verbs', function(done){
      var router = new Router();

      var count = 0;
      //使用.all捕获所有对'/foo'的http请求
      router.all('/foo', function(){ count++; });

      var url = '/foo?bar=baz';

      //调用method中的所有http访问方法
      methods.forEach(function testMethod(method) {
        router.handle({ url: url, method: method }, {}, function() {});
      });

      //若中间件调用的次数是否和方法数相等，用例通过
      assert.equal(count, methods.length);
      done();
    })
  })

  //.use测试模块
  describe('.use', function() {
    //检测是否请求丢失参数
    it('should require arguments', function(){
      var router = new Router();
      router.use.bind(router).should.throw(/requires middleware function/)
    })

    //检测是否拒绝非函数参数
    it('should not accept non-functions', function(){
      var router = new Router();
      //一次给string,int,null,Date参数，若都抛出对应错误，测试通过
      router.use.bind(router, '/', 'hello').should.throw(/requires middleware function.*string/)
      router.use.bind(router, '/', 5).should.throw(/requires middleware function.*number/)
      router.use.bind(router, '/', null).should.throw(/requires middleware function.*Null/)
      router.use.bind(router, '/', new Date()).should.throw(/requires middleware function.*Date/)
    })

    //检测是否接受以数组形式给的中间件参数
    it('should accept array of middleware', function(done){
      var count = 0;
      var router = new Router();

      function fn1(req, res, next){
        assert.equal(++count, 1);
        next();
      }

      function fn2(req, res, next){
        assert.equal(++count, 2);
        next();
      }

      //以数组的形式给出中间件参数
      router.use([fn1, fn2], function(req, res){
        assert.equal(++count, 3);
        done();
      });

      router.handle({ url: '/foo', method: 'GET' }, {}, function(){});
    })
  })

  //.param检测模块
  describe('.param', function() {

    //检测rapam是否在路由到参数的时候触发
    it('should call param function when routing VERBS', function(done) {
      var router = new Router();

      //若检测到输入参数，则触发
      router.param('id', function(req, res, next, id) {
        assert.equal(id, '123');
        next();
      });

      //设定参数
      router.get('/foo/:id/bar', function(req, res, next) {
        assert.equal(req.params.id, '123');
        next();
      });

      router.handle({ url: '/foo/123/bar', method: 'get' }, {}, done);
    });

    //检测路由中间件时是否应该触发param函数
    it('should call param function when routing middleware', function(done) {
      var router = new Router();

      router.param('id', function(req, res, next, id) {
        assert.equal(id, '123');
        next();
      });

      //若路径后有url，仍然路由中间件则用例通过
      router.use('/foo/:id/bar', function(req, res, next) {
        assert.equal(req.params.id, '123');
        assert.equal(req.url, '/baz');
        next();
      });

      router.handle({ url: '/foo/123/bar/baz', method: 'get' }, {}, done);
    });

    //每次请求中相同的参数只触发一次param
    it('should only call once per request', function(done) {
      var count = 0;
      var req = { url: '/foo/bob/bar', method: 'get' };
      var router = new Router();
      var sub = new Router();

      sub.get('/bar', function(req, res, next) {
        next();
      });

      //每执行一次，count++
      router.param('user', function(req, res, next, user) {
        count++;
        req.user = user;
        next();
      });

      //触发两次'user'参数
      router.use('/foo/:user/', new Router());
      router.use('/foo/:user/', sub);

      //若只触发一次，用例通过
      router.handle(req, {}, function(err) {
        if (err) return done(err);
        assert.equal(count, 1);
        assert.equal(req.user, 'bob');
        done();
      });
    });

    //若请求中参数变化则触发多次param
    it('should call when values differ', function(done) {
      var count = 0;
      var req = { url: '/foo/bob/bar', method: 'get' };
      var router = new Router();
      var sub = new Router();

      sub.get('/bar', function(req, res, next) {
        next();
      });

      router.param('user', function(req, res, next, user) {
        count++;
        req.user = user;
        next();
      });

      //user参数分别设为'bob'和'foo'
      router.use('/foo/:user/', new Router());
      router.use('/:user/bob/', sub);

      //触发两次则用例通过
      router.handle(req, {}, function(err) {
        if (err) return done(err);
        assert.equal(count, 2);
        assert.equal(req.user, 'foo');
        done();
      });
    });
  });

  //并行请求测试模块
  describe('parallel requests', function() {
    //检测是否混淆模块
    it('should not mix requests', function(done) {
      var req1 = { url: '/foo/50/bar', method: 'get' };
      var req2 = { url: '/foo/10/bar', method: 'get' };
      var router = new Router();
      var sub = new Router();

      //两次请求都不出错，用例通过
      done = after(2, done);

      sub.get('/bar', function(req, res, next) {
        next();
      });

      router.param('ms', function(req, res, next, ms) {
        ms = parseInt(ms, 10);
        req.ms = ms;
        setTimeout(next, ms);
      });

      router.use('/foo/:ms/', new Router());
      router.use('/foo/:ms/', sub);

      //分别以50和10赋值ms，发出请求
      //未出错则done()一次
      router.handle(req1, {}, function(err) {
        assert.ifError(err);
        assert.equal(req1.ms, 50);
        assert.equal(req1.originalUrl, '/foo/50/bar');
        done();
      });

      router.handle(req2, {}, function(err) {
        assert.ifError(err);
        assert.equal(req2.ms, 10);
        assert.equal(req2.originalUrl, '/foo/10/bar');
        done();
      });
    });
  });
})
