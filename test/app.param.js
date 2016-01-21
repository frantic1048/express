
//导入模块
var express = require('../')
  , request = require('supertest');

//app测试模块
describe('app', function(){
  //param(fn)测试模块
  describe('.param(fn)', function(){
    //检测能否更改param的形式
    it('should map app.param(name, ...) logic', function(done){
      var app = express();

      //app.param原本参数列表为(string,function)，此处更改为(string,regexp(正则表达式))
      app.param(function(name, regexp){
        if (Object.prototype.toString.call(regexp) == '[object RegExp]') { // See #1557
          return function(req, res, next, val){
            var captures;
            //用正则表达式匹配字符串并添加到param
            if (captures = regexp.exec(String(val))) {
              req.params[name] = captures[1];
              next();
            } else {
              next('route');
            }
          }
        }
      })

      //用(string,regexp)的形式添加变量中间件
      app.param(':name', /^([a-zA-Z]+)$/);

      //将设置的parma返回
      app.get('/user/:name', function(req, res){
        res.send(req.params.name);
      });

      //若成功返回匹配的字符串，对不匹配的返回404，用例通过
      request(app)
      .get('/user/tj')
      .end(function(err, res){
        res.text.should.equal('tj');
        request(app)
        .get('/user/123')
        .expect(404, done);
      });

    })

    //检测不绑定函数是否报错
    it('should fail if not given fn', function(){
      var app = express();
      //绑定字符串
      app.param.bind(app, ':name', 'bob').should.throw();
    })
  })

  //param(names, fn)测试模块
  describe('.param(names, fn)', function(){
    //检测是否支持数组映射
    it('should map the array', function(done){
      var app = express();

      //数组形式设定检测'id','uid'参数的使用
      //将值设置给param.id
      app.param(['id', 'uid'], function(req, res, next, id){
        id = Number(id);
        if (isNaN(id)) return next('route');
        req.params.id = id;
        next();
      });

      //分别对两种参数设置get方法，检测返回值
      app.get('/post/:id', function(req, res){
        var id = req.params.id;
        id.should.be.a.Number;
        res.send('' + id);
      });

      app.get('/user/:uid', function(req, res){
        var id = req.params.id;
        id.should.be.a.Number;
        res.send('' + id);
      });

      //两种参数都正确返回，用例通过
      request(app)
      .get('/user/123')
      .end(function(err, res){
        res.text.should.equal('123');

        request(app)
        .get('/post/123')
        .expect('123', done);
      })
    })
  })

  //param(name, fn)测试模块
  describe('.param(name, fn)', function(){
    //检测单个元素能否正常响应
    it('should map logic for a single param', function(done){
      var app = express();

      //只设定一个元素的响应
      app.param('id', function(req, res, next, id){
        id = Number(id);
        if (isNaN(id)) return next('route');
        req.params.id = id;
        next();
      });

      app.get('/user/:id', function(req, res){
        var id = req.params.id;
        id.should.be.a.Number;
        res.send('' + id);
      });

      //正常返回则用例通过
      request(app)
      .get('/user/123')
      .expect('123', done);
    })

    //检测是否在一次请求中只触发一次
    it('should only call once per request', function(done) {
      var app = express();
      var called = 0;
      var count = 0;

      //每触发一次called++
      app.param('user', function(req, res, next, user) {
        called++;
        req.user = user;
        next();
      });

      //设置两次相同调用
      //每次调用count++
      app.get('/foo/:user', function(req, res, next) {
        count++;
        next();
      });
      app.get('/foo/:user', function(req, res, next) {
        count++;
        next();
      });
      app.use(function(req, res) {
        res.end([count, called, req.user].join(' '));
      });

      //若count==2,called==1，用例通过
      request(app)
      .get('/foo/bob')
      .expect('2 1 bob', done);
    })

    //当参数位置不同时，一次请求也应该多次调用
    it('should call when values differ', function(done) {
      var app = express();
      var called = 0;
      var count = 0;

      app.param('user', function(req, res, next, user) {
        called++;
        req.users = (req.users || []).concat(user);
        next();
      });

      //两次都调用参数'user'，但位置不同
      app.get('/:user/bob', function(req, res, next) {
        count++;
        next();
      });
      app.get('/foo/:user', function(req, res, next) {
        count++;
        next();
      });
      app.use(function(req, res) {
        res.end([count, called, req.users.join(',')].join(' '));
      });

      //若called，count都为2，用例通过
      request(app)
      .get('/foo/bob')
      .expect('2 2 foo,bob', done);
    })

    //检测是否通过路由能够修改参数
    it('should support altering req.params across routes', function(done) {
      var app = express();

      //修改'user'参数为'loki'
      app.param('user', function(req, res, next, user) {
        req.params.user = 'loki';
        next();
      });

      app.get('/:user', function(req, res, next) {
        next('route');
      });
      app.get('/:user', function(req, res, next) {
        res.send(req.params.user);
      });

      //若修改了参数，用例通过
      request(app)
      .get('/bob')
      .expect('loki', done);
    })

    //检测是否调用未被路由的参数
    it('should not invoke without route handler', function(done) {
      var app = express();

      app.param('thing', function(req, res, next, thing) {
        req.thing = thing;
        next();
      });

      //若错误调用将会报错
      app.param('user', function(req, res, next, user) {
        next(new Error('invalid invokation'));
      });

      app.post('/:user', function(req, res, next) {
        res.send(req.params.user);
      });

      app.get('/:thing', function(req, res, next) {
        res.send(req.thing);
      });

      //用get方法，若不触发post方法，用例通过
      request(app)
      .get('/bob')
      .expect(200, 'bob', done);
    })

    //检测是否只对编码的值起作用
    it('should work with encoded values', function(done){
      var app = express();

      app.param('name', function(req, res, next, name){
        req.params.name = name;
        next();
      });

      app.get('/user/:name', function(req, res){
        var name = req.params.name;
        res.send('' + name);
      });

      //若舍弃25，用例通过
      request(app)
      .get('/user/foo%25bar')
      .expect('foo%bar', done);
    })

    //检测能否catch抛出的错误
    it('should catch thrown error', function(done){
      var app = express();

      //抛出错误
      app.param('id', function(req, res, next, id){
        throw new Error('err!');
      });

      app.get('/user/:id', function(req, res){
        var id = req.params.id;
        res.send('' + id);
      });

      //若正确catch抛出的错误，用例通过
      request(app)
      .get('/user/123')
      .expect(500, done);
    })

    //能够catch第二层报的错
    it('should catch thrown secondary error', function(done){
      var app = express();

      //跳转至下一个函数
      app.param('id', function(req, res, next, val){
        process.nextTick(next);
      });

      //在第二层报错
      app.param('id', function(req, res, next, id){
        throw new Error('err!');
      });

      app.get('/user/:id', function(req, res){
        var id = req.params.id;
        res.send('' + id);
      });

      //若能成功检测出第二层报出的错误，用例通过
      request(app)
      .get('/user/123')
      .expect(500, done);
    })

    //检测是否推到下一个路由
    it('should defer to next route', function(done){
      var app = express();

      //转到下一个路由
      app.param('id', function(req, res, next, id){
        next('route');
      });

      app.get('/user/:id', function(req, res){
        var id = req.params.id;
        res.send('' + id);
      });

      //若转到此路由，应该返回'name'
      app.get('/:name/123', function(req, res){
        res.send('name');
      });

      //若成功返回'name'，用例通过
      request(app)
      .get('/user/123')
      .expect('name', done);
    })

    //若方式不同，需要经由所有的路由
    it('should defer all the param routes', function(done){
      var app = express();

      app.param('id', function(req, res, next, val){
        if (val === 'new') return next('route');
        return next();
      });

      //all和get方式不同，都经由param，执行next
      app.all('/user/:id', function(req, res){
        res.send('all.id');
      });

      app.get('/user/:id', function(req, res){
        res.send('get.id');
      });

      //最终执行这个函数
      app.get('/user/new', function(req, res){
        res.send('get.new');
      });

      //若成功返回'get.new'，用例通过
      request(app)
      .get('/user/new')
      .expect('get.new', done);
    })

    //检测当param报错时有没有将请求终止
    it('should not call when values differ on error', function(done) {
      var app = express();
      var called = 0;
      var count = 0;

      //使用参数'user'时直接报错
      app.param('user', function(req, res, next, user) {
        called++;
        if (user === 'foo') throw new Error('err!');
        req.user = user;
        next();
      });

      //由于已报错，向后都不再执行
      app.get('/:user/bob', function(req, res, next) {
        count++;
        next();
      });
      app.get('/foo/:user', function(req, res, next) {
        count++;
        next();
      });

      app.use(function(err, req, res, next) {
        res.status(500);
        res.send([count, called, err.message].join(' '));
      });

      //因没有执行，所以called的值应该为0
      //若成功检测到报错，用例通过
      request(app)
      .get('/foo/bob')
      .expect(500, '0 1 err!', done)
    });

    //检测在next时变量值发生变化时是否再次触发param
    it('should call when values differ when using "next"', function(done) {
      var app = express();
      var called = 0;
      var count = 0;

      app.param('user', function(req, res, next, user) {
        called++;
        //user值为'foo'的get被跳过，count只++一次
        if (user === 'foo') return next('route');
        req.user = user;
        next();
      });

      app.get('/:user/bob', function(req, res, next) {
        count++;
        next();
      });
      app.get('/foo/:user', function(req, res, next) {
        count++;
        next();
      });
      app.use(function(req, res) {
        res.end([count, called, req.user].join(' '));
      });

      //若parma执行两次，而get中只有一个被执行，用例通过
      request(app)
      .get('/foo/bob')
      .expect('1 2 bob', done);
    })
  })
})
