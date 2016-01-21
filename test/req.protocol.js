
//导入模块
var express = require('../')
  , request = require('supertest');

//req检测模块
describe('req', function(){
  //.protocol检测模块
  describe('.protocol', function(){
    //检测是否返回协议类型
    it('should return the protocol string', function(done){
      var app = express();

      app.use(function(req, res){
        res.end(req.protocol);
      });

      //若返回正确的'http'类型，用例通过
      request(app)
      .get('/')
      .expect('http', done);
    })

    //打开trust proxy检测模块
    describe('when "trust proxy" is enabled', function(){
      //检测是否遵守X-Forwarded-Proto HTTP头
      it('should respect X-Forwarded-Proto', function(done){
        var app = express();

        //打开trust proxy
        app.enable('trust proxy');

        app.use(function(req, res){
          res.end(req.protocol);
        });

        //设置'X-Forwarded-Proto'的值
        //若req.protocal的值被更改，用例通过
        request(app)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect('https', done);
      })

      //检测当X-Forwarded-Proto未声明时是否默认socket addr
      it('should default to the socket addr if X-Forwarded-Proto not present', function(done){
        var app = express();

        app.enable('trust proxy');

        app.use(function(req, res){
          req.connection.encrypted = true;
          res.end(req.protocol);
        });

        //不声明X-Forwarded-Proto,若返回https协议，用例通过
        request(app)
        .get('/')
        .expect('https', done);
      })

      //检测socket addr是不可信时是否忽视X-Forwarded-Proto
      it('should ignore X-Forwarded-Proto if socket addr not trusted', function(done){
        var app = express();

        //给trust proxy无效的地址
        app.set('trust proxy', '10.0.0.1');

        app.use(function(req, res){
          res.end(req.protocol);
        });

        //若无视'X-Forwarded-Proto'，返回'http'协议类型，用例通过
        request(app)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect('http', done);
      })

      //检测未设置值是否默认返回http
      it('should default to http', function(done){
        var app = express();

        app.enable('trust proxy');

        app.use(function(req, res){
          res.end(req.protocol);
        });

        //若返回默认http，用例通过
        request(app)
        .get('/')
        .expect('http', done);
      })

      //信任跳跃次数测试模块
      describe('when trusting hop count', function () {
        it('should respect X-Forwarded-Proto', function (done) {
          var app = express();

          //设置信任跳跃次数为1
          app.set('trust proxy', 1);

          app.use(function (req, res) {
            res.end(req.protocol);
          });

          //若仍然支持X-Forwarded-Proto，用例通过
          request(app)
          .get('/')
          .set('X-Forwarded-Proto', 'https')
          .expect('https', done);
        })
      })
    })

    //关闭"trust proxy"测试模块
    describe('when "trust proxy" is disabled', function(){
      //关闭"trust proxy"，应该忽视X-Forwarded-Proto
      it('should ignore X-Forwarded-Proto', function(done){
        var app = express();

        app.use(function(req, res){
          res.end(req.protocol);
        });

        //在未打开trust proxy的情况下设置X-Forwarded-Proto
        //若返回默认值'http'，用例通过
        request(app)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect('http', done);
      })
    })
  })
})
