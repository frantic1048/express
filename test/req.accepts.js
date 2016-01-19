
//导入模块
var express = require('../')
  , request = require('supertest');

//req测试模块
describe('req', function(){
  //.accepts(type)测试模块
  describe('.accepts(type)', function(){
    //检测未设置accept时是否返回true
    it('should return true when Accept is not present', function(done){
      var app = express();

      //收到json返回true，否则false
      app.use(function(req, res, next){
        res.end(req.accepts('json') ? 'yes' : 'no');
      });

      //不设置accept
      request(app)
      .get('/')
      .expect('yes', done);
    })

    //检测设置相同accept时是否返回true
    it('should return true when present', function(done){
      var app = express();

      app.use(function(req, res, next){
        res.end(req.accepts('json') ? 'yes' : 'no');
      });

      //设置accept为相同的json
      request(app)
      .get('/')
      .set('Accept', 'application/json')
      .expect('yes', done);
    })

    //检测设置不同accept时是否返回false
    it('should return false otherwise', function(done){
      var app = express();

      app.use(function(req, res, next){
        res.end(req.accepts('json') ? 'yes' : 'no');
      });

      //设置accept为相同的html
      request(app)
      .get('/')
      .set('Accept', 'text/html')
      .expect('no', done);
    })
  })

  //检测是否接受一个列表的类型
  it('should accept an argument list of type names', function(done){
    var app = express();

    //设置多个接受类型
    app.use(function(req, res, next){
      res.end(req.accepts('json', 'html'));
    });

    request(app)
    .get('/')
    .set('Accept', 'application/json')
    .expect('json', done);
  })

  //.accepts(types)测试模块
  describe('.accepts(types)', function(){
    //检测当accept未设置时是否返回第一个类型
    it('should return the first when Accept is not present', function(done){
      var app = express();

      //设置多个类型，json为第一个
      app.use(function(req, res, next){
        res.end(req.accepts(['json', 'html']));
      });

      //若返回json，用例通过
      request(app)
      .get('/')
      .expect('json', done);
    })

    //检测当accept设置时是否返回第一个匹配的类型
    it('should return the first acceptable type', function(done){
      var app = express();

      //设置多个类型，json为第一个
      //accept设置的参数为html类型，应该返回第二个
      app.use(function(req, res, next){
        res.end(req.accepts(['json', 'html']));
      });

      //若返回html，用例通过
      request(app)
      .get('/')
      .set('Accept', 'text/html')
      .expect('html', done);
    })

    //检测当没有类型匹配时是否返回false
    it('should return false when no match is made', function(done){
      var app = express();

      //设置不同于accept参数的类型
      app.use(function(req, res, next){
        res.end(req.accepts(['text/html', 'application/json']) ? 'yup' : 'nope');
      });

      //若返回false，用例通过
      request(app)
      .get('/')
      .set('Accept', 'foo/bar, bar/baz')
      .expect('nope', done);
    })

    //检测能否获得accept中的quality参数
    it('should take quality into account', function(done){
      var app = express();

      app.use(function(req, res, next){
        res.end(req.accepts(['text/html', 'application/json']));
      });

      //设置quality参数，若成功返回提取参数后的类型，用例通过
      request(app)
      .get('/')
      .set('Accept', '*/html; q=.5, application/json')
      .expect('application/json', done);
    })

    //检测设置模糊类型时能否返回第一个匹配的类型
    it('should return the first acceptable type with canonical mime types', function(done){
      var app = express();

      app.use(function(req, res, next){
        res.end(req.accepts(['application/json', 'text/html']));
      });

      //设置模糊类型'*/html'
      //若返回第一个匹配的类型'text/html'，用例通过
      request(app)
      .get('/')
      .set('Accept', '*/html')
      .expect('text/html', done);
    })
  })
})
