
//添加模块
var express = require('../')
  , request = require('supertest')
  , cookie = require('cookie')
  , cookieParser = require('cookie-parser')
var merge = require('utils-merge');

//res测试模块
describe('res', function(){
  //cookie(name,object)测试模块
  describe('.cookie(name, object)', function(){
    //检测是否生成一个json的cookie
    it('should generate a JSON cookie', function(done){
      var app = express();

      //生成cookie
      app.use(function(req, res){
        res.cookie('user', { name: 'tobi' }).end();
      });

      //若返回的cookie符合json格式，用例通过
      request(app)
      .get('/')
      .end(function(err, res){
        var val = ['user=' + encodeURIComponent('j:{"name":"tobi"}') + '; Path=/'];
        res.headers['set-cookie'].should.eql(val);
        done();
      })
    })
  })

  //cookie(name,string)测试模块
  describe('.cookie(name, string)', function(){
    //检测通过cookie(name,string)能否正常生成cookie
    it('should set a cookie', function(done){
      var app = express();

      //通过cookie(name,string)生成cookie
      app.use(function(req, res){
        res.cookie('name', 'tobi').end();
      });

      //若正常生成cookie,用例通过
      request(app)
      .get('/')
      .end(function(err, res){
        var val = ['name=tobi; Path=/'];
        res.headers['set-cookie'].should.eql(val);
        done();
      })
    })

    //检测多次执行cookie是否正常执行
    it('should allow multiple calls', function(done){
      var app = express();

      //三次调用cookie()
      app.use(function(req, res){
        res.cookie('name', 'tobi');
        res.cookie('age', 1);
        res.cookie('gender', '?');
        res.end();
      });

      //若生成了一个包含三次调用的内容的cookie，用例通过
      request(app)
      .get('/')
      .end(function(err, res){
        var val = ['name=tobi; Path=/', 'age=1; Path=/', 'gender=%3F; Path=/'];
        res.headers['set-cookie'].should.eql(val);
        done();
      })
    })
  })

  //cookie(name, string, options)检测模块
  describe('.cookie(name, string, options)', function(){
    //检测是否生成cookie
    it('should set params', function(done){
      var app = express();

      //用cookie(name, string, options)生成cookie
      app.use(function(req, res){
        res.cookie('name', 'tobi', { httpOnly: true, secure: true });
        res.end();
      });

      //若正常生成cookie，用例通过
      request(app)
      .get('/')
      .end(function(err, res){
        var val = ['name=tobi; Path=/; HttpOnly; Secure'];
        res.headers['set-cookie'].should.eql(val);
        done();
      })
    })

    //最长生存时间模块
    describe('maxAge', function(){
      //应该生成关联当前时间期限
      it('should set relative expires', function(done){
        var app = express();

        //设置maxage为1000
        app.use(function(req, res){
          res.cookie('name', 'tobi', { maxAge: 1000 });
          res.end();
        });

        //若maxage不是以默认时间关联设定，用例通过
        request(app)
        .get('/')
        .end(function(err, res){
          res.headers['set-cookie'][0].should.not.containEql('Thu, 01 Jan 1970 00:00:01 GMT');
          done();
        })
      })

      //检修设定maxAge后Max-Age的值是否修改
      it('should set max-age', function(done){
        var app = express();

        app.use(function(req, res){
          res.cookie('name', 'tobi', { maxAge: 1000 });
          res.end();
        });

        //若Max-Age的属性值被修改，用例通过
        request(app)
        .get('/')
        .expect('Set-Cookie', /Max-Age=1/, done)
      })

      //检测options的对象是否改变
      it('should not mutate the options object', function(done){
        var app = express();

        //给options设置一份拷贝
        var options = { maxAge: 1000 };
        var optionsCopy = merge({}, options);

        //只改变options的值
        app.use(function(req, res){
          res.cookie('name', 'tobi', options)
          res.end();
        });

        //若options与拷贝的值依然相等，用例通过
        request(app)
        .get('/')
        .end(function(err, res){
          options.should.eql(optionsCopy);
          done();
        })
      })
    })

    //signed检测模块
    describe('signed', function(){
      //检测能否正常使用签名cookie
      it('should generate a signed JSON cookie', function(done){
        var app = express();

        //添加签名
        app.use(cookieParser('foo bar baz'));

        app.use(function(req, res){
          res.cookie('user', { name: 'tobi' }, { signed: true }).end();
        });

        //若正常生成签名cookie，用例通过
        request(app)
        .get('/')
        .end(function(err, res){
          var val = res.headers['set-cookie'][0];
          //将签名部分分开
          val = cookie.parse(val.split('.')[0]);
          val.user.should.equal('s:j:{"name":"tobi"}');
          done();
        })
      })
    })

    //signedCookie(name, string)检测模块
    describe('.signedCookie(name, string)', function(){
      //检测能否正常使用签名cookie
      it('should set a signed cookie', function(done){
        var app = express();

        //添加签名
        app.use(cookieParser('foo bar baz'));

        //使用signedCookie(name, string)生成cookie
        app.use(function(req, res){
          res.cookie('name', 'tobi', { signed: true }).end();
        });

        //若正常生成签名cookie，用例通过
        request(app)
        .get('/')
        .end(function(err, res){
          var val = ['name=s%3Atobi.xJjV2iZ6EI7C8E5kzwbfA9PVLl1ZR07UTnuTgQQ4EnQ; Path=/'];
          res.headers['set-cookie'].should.eql(val);
          done();
        })
      })
    })
  })
})
