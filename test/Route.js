
//导入模块
var after = require('after');
var should = require('should');
var express = require('../')
  , Route = express.Route
  , methods = require('methods')
  , assert = require('assert');

//Route测试模块
describe('Route', function(){

  //.all测试模块
  describe('.all', function(){
    //检测
    it('should add handler', function(done){
      var req = { method: 'GET', url: '/' };
      var route = new Route('/foo');

      //得到http请求便将called设置为true
      route.all(function(req, res, next) {
        req.called = true;
        next();
      });

      //将get请求路由给route下所有路径
      //若called值设置正确，用例通过
      route.dispatch(req, {}, function (err) {
        if (err) return done(err);
        should(req.called).be.ok;
        done();
      });
    })

    //检测能否响应所有http请求
    it('should handle VERBS', function(done) {
      var count = 0;
      var route = new Route('/foo');
      //接受所有方法后通过用例
      var cb = after(methods.length, function (err) {
        if (err) return done(err);
        count.should.equal(methods.length);
        done();
      });

      //对所有请求计数
      route.all(function(req, res, next) {
        count++;
        next();
      });

      //将所有的方法分发给route下所有路径
      methods.forEach(function testMethod(method) {
        var req = { method: method, url: '/' };
        route.dispatch(req, {}, cb);
      });
    })

    //检测是否堆叠调用
    it('should stack', function(done) {
      var req = { count: 0, method: 'GET', url: '/' };
      var route = new Route('/foo');

      //每个对route的请求都将经过两个响应
      route.all(function(req, res, next) {
        req.count++;
        next();
      });

      route.all(function(req, res, next) {
        req.count++;
        next();
      });

      //若成功得到两次响应，用例通过
      route.dispatch(req, {}, function (err) {
        if (err) return done(err);
        req.count.should.equal(2);
        done();
      });
    })
  })

  //.VERB测试模块
  describe('.VERB', function(){
    //检测是否支持get方法
    it('should support .get', function(done){
      var req = { method: 'GET', url: '/' };
      var route = new Route('');

      //对get方法设置响应
      route.get(function(req, res, next) {
        req.called = true;
        next();
      })

      //若get方法能得到预期结果，用例通过
      route.dispatch(req, {}, function (err) {
        if (err) return done(err);
        should(req.called).be.ok;
        done();
      });
    })

    //检测是否只对对应请求响应
    it('should limit to just .VERB', function(done){
      var req = { method: 'POST', url: '/' };
      var route = new Route('');

      //若响应了get会报错
      route.get(function(req, res, next) {
        throw new Error('not me!');
      })

      route.post(function(req, res, next) {
        req.called = true;
        next();
      })

      //若只响应了post，用例通过
      route.dispatch(req, {}, function (err) {
        if (err) return done(err);
        should(req.called).be.true;
        done();
      });
    })

    //检测是否允许连续调用
    it('should allow fallthrough', function(done){
      var req = { order: '', method: 'GET', url: '/' };
      var route = new Route('');

      //依次给空字符串添加'a','b','c'
      route.get(function(req, res, next) {
        req.order += 'a';
        next();
      })

      route.all(function(req, res, next) {
        req.order += 'b';
        next();
      });

      route.get(function(req, res, next) {
        req.order += 'c';
        next();
      })

      //若得到'abc'返回值则用例通过
      route.dispatch(req, {}, function (err) {
        if (err) return done(err);
        req.order.should.equal('abc');
        done();
      });
    })
  })

  //错误检测模块
  describe('errors', function(){
    //检测是否通过四参数的函数处理错误
    it('should handle errors via arity 4 functions', function(done){
      var req = { order: '', method: 'GET', url: '/' };
      var route = new Route('');

      //报'foobar'错
      route.all(function(req, res, next){
        next(new Error('foobar'));
      });

      //若从三参数函数经过，添加'0',否则,添加'a'
      route.all(function(req, res, next){
        req.order += '0';
        next();
      });

      route.all(function(err, req, res, next){
        req.order += 'a';
        next(err);
      });

      //若req.order的值为'a'，则用例通过
      route.dispatch(req, {}, function (err) {
        should(err).be.ok;
        should(err.message).equal('foobar');
        req.order.should.equal('a');
        done();
      });
    })

    //检测没有next()是否能处理错误
    it('should handle throw', function(done) {
      var req = { order: '', method: 'GET', url: '/' };
      var route = new Route('');

      //仅仅抛出错误而没有将其传递
      route.all(function(req, res, next){
        throw new Error('foobar');
      });

      route.all(function(req, res, next){
        req.order += '0';
        next();
      });

      route.all(function(err, req, res, next){
        req.order += 'a';
        next(err);
      });

      //若req.order的值仍为'a'，则用例通过
      route.dispatch(req, {}, function (err) {
        should(err).be.ok;
        should(err.message).equal('foobar');
        req.order.should.equal('a');
        done();
      });
    });

    //检测能否处理内部抛出的 错误处理
    it('should handle throwing inside error handlers', function(done) {
      var req = { method: 'GET', url: '/' };
      var route = new Route('');

      //报'bppm!'错
      route.get(function(req, res, next){
        throw new Error('boom!');
      });

      //处理错误，再报'oops'错
      route.get(function(err, req, res, next){
        throw new Error('oops');
      });

      //处理错误处理报出的'oops'错
      route.get(function(err, req, res, next){
        req.message = err.message;
        next();
      });

      //若处理错误处理的处理成功运行，用例通过
      route.dispatch(req, {}, function (err) {
        if (err) return done(err);
        should(req.message).equal('oops');
        done();
      });
    });

    //检测.all中抛出的错误有没有被处理
    it('should handle throw in .all', function(done) {
      var req = { method: 'GET', url: '/' };
      var route = new Route('');

      //.all中抛出了错误
      route.all(function(req, res, next){
        throw new Error('boom!');
      });

      //若返回正确的错误，用例通过
      route.dispatch(req, {}, function(err){
        should(err).be.ok;
        err.message.should.equal('boom!');
        done();
      });
    });

    //检测只有错误处理的能否正常运行
    it('should handle single error handler', function(done) {
      var req = { method: 'GET', url: '/' };
      var route = new Route('');

      //该部分将不会运行
      route.all(function(err, req, res, next){
        true.should.be.false;
      });

      //若正常运行（不经过错误处理），用例通过
      route.dispatch(req, {}, done);
    });
  })
})
