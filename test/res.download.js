
//导入模块
var after = require('after');
var assert = require('assert');
var express = require('..');
var request = require('supertest');

//res检测模块
describe('res', function(){
  //download(path)检测模块
  describe('.download(path)', function(){
    //检测是否传输附件
    it('should transfer as an attachment', function(done){
      var app = express();

      //开始下载附件
      app.use(function(req, res){
        res.download('test/fixtures/user.html');
      });

      //若正常下载附件，用例通过
      request(app)
      .get('/')
      .expect('Content-Type', 'text/html; charset=UTF-8')
      .expect('Content-Disposition', 'attachment; filename="user.html"')
      .expect(200, '<p>{{user.name}}</p>', done)
    })
  })

  //download(path, filename)测试模块
  describe('.download(path, filename)', function(){
    //检测是否支持更改下载文件名
    it('should provide an alternate filename', function(done){
      var app = express();

      //将下载的文件名更改为'document'
      app.use(function(req, res){
        res.download('test/fixtures/user.html', 'document');
      });

      //若下载的文件名被正常修改，用例通过
      request(app)
      .get('/')
      .expect('Content-Type', 'text/html; charset=UTF-8')
      .expect('Content-Disposition', 'attachment; filename="document"')
      .expect(200, done)
    })
  })

  //download(path, fn)测试模块
  describe('.download(path, fn)', function(){
    //检测是否调用声明的回调函数
    it('should invoke the callback', function(done){
      var app = express();
      var cb = after(2, done);

      //声明回调函数cb
      app.use(function(req, res){
        res.download('test/fixtures/user.html', cb);
      });

      //若正常执行回调函数，将两次执行cb，用例通过
      request(app)
      .get('/')
      .expect('Content-Type', 'text/html; charset=UTF-8')
      .expect('Content-Disposition', 'attachment; filename="user.html"')
      .expect(200, cb);
    })
  })

  //download(path, filename, fn)测试模块
  describe('.download(path, filename, fn)', function(){
    //检测是否调用回调函数
    it('should invoke the callback', function(done){
      var app = express();
      var cb = after(2, done);

      //使用三个参数的download函数
      //（此处似乎应该是cb而非done）
      app.use(function(req, res){
        res.download('test/fixtures/user.html', 'document', done);
      });

      //若正常更改文件名，并执行回调函数，用例通过
      request(app)
      .get('/')
      .expect('Content-Type', 'text/html; charset=UTF-8')
      .expect('Content-Disposition', 'attachment; filename="document"')
      .expect(200, cb);
    })
  })

  //错误测试模块
  describe('on failure', function(){
    //检测是否调用回调成功报错
    it('should invoke the callback', function(done){
      var app = express();

      //若调用回调，强制报错
      app.use(function (req, res, next) {
        res.download('test/fixtures/foobar.html', function(err){
          if (!err) return next(new Error('expected error'));
          res.send('got ' + err.status + ' ' + err.code);
        });
      });

      //若检测到报错，用例通过
      request(app)
      .get('/')
      .expect(200, 'got 404 ENOENT', done);
    })

    //检测报错后是否删除Content-Disposition
    it('should remove Content-Disposition', function(done){
      var app = express()
        , calls = 0;

      //强制报错
      app.use(function (req, res, next) {
        res.download('test/fixtures/foobar.html', function(err){
          if (!err) return next(new Error('expected error'));
          res.end('failed');
        });
      });

      //检测到Content-Disposition已经被移除，用例通过
      request(app)
      .get('/')
      .expect(shouldNotHaveHeader('Content-Disposition'))
      .expect(200, 'failed', done);
    })
  })
})

//检测文件头某项是否被移除的函数
function shouldNotHaveHeader(header) {
  //若对应项不存在与header，测试通过
  return function (res) {
    assert.ok(!(header.toLowerCase() in res.headers), 'should not have header ' + header);
  };
}
